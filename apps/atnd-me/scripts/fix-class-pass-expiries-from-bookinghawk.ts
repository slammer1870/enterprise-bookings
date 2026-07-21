#!/usr/bin/env tsx
/**
 * Repair class-pass expirationDate values that were incorrectly set to purchase + 5 years
 * during the BookingHawk import. Restores the original BookingHawk expiryDate by joining
 * publicReference → class-passes.transactionId.
 *
 * For source rows with "no expiry", leaves the existing expirationDate unchanged (the 5y
 * fallback was already applied at import).
 *
 * When the restored expiry is in the past and status is still "active", sets status to
 * "expired". Does not change used/cancelled statuses.
 *
 * Usage (from apps/atnd-me):
 *   DATABASE_URI=... PAYLOAD_SECRET=... \
 *   pnpm exec tsx scripts/fix-class-pass-expiries-from-bookinghawk.ts \
 *     --input /path/to/creditbundlesfloat.json \
 *     --tenant-slug my-tenant \
 *     --dry-run
 *
 * Live database (requires explicit opt-in):
 *   NODE_ENV=production DATABASE_URI=... PAYLOAD_SECRET=... \
 *   pnpm exec tsx scripts/fix-class-pass-expiries-from-bookinghawk.ts \
 *     --input /path/to/creditbundlesfloat.json \
 *     --tenant-slug my-tenant \
 *     --allow-production
 */

import 'dotenv/config'

import { readFileSync } from 'node:fs'

import { createLocalReq } from 'payload'
import { checkRole } from '@repo/shared-utils'
import type { User } from '@repo/shared-types'

import { getPayload } from '@/lib/payload'

const CLASS_PASSES = 'class-passes'

type Args = {
  inputPath: string
  tenantId?: string
  tenantSlug?: string
  dryRun: boolean
  allowProduction: boolean
}

type SourceRow = {
  publicReference: string
  purchaseDate: string
  expiryDate: string
}

type SourceFile = {
  creditBundleSearchResults: SourceRow[]
}

type ClassPassDoc = {
  id: number
  transactionId?: string | null
  expirationDate?: string | null
  status?: string | null
  purchasedAt?: string | null
}

function readArg(argv: string[], name: string): string | undefined {
  const eq = argv.find((a) => a.startsWith(`${name}=`))
  if (eq) return eq.split('=').slice(1).join('=')
  const i = argv.indexOf(name)
  return i >= 0 ? argv[i + 1] : undefined
}

function parseArgs(argv: string[]): Args {
  const inputPath = readArg(argv, '--input')

  if (!inputPath) {
    console.error('❌ Provide --input /path/to/creditbundlesfloat.json')
    process.exit(1)
  }

  return {
    inputPath,
    tenantId: readArg(argv, '--tenant-id'),
    tenantSlug: readArg(argv, '--tenant-slug'),
    dryRun: argv.includes('--dry-run'),
    allowProduction: argv.includes('--allow-production'),
  }
}

function blockInProductionUnlessAllowed(allowProduction: boolean): void {
  const nodeEnv = process.env.NODE_ENV || 'development'
  if (nodeEnv === 'production' && !allowProduction) {
    console.error(
      '❌ Refusing to run with NODE_ENV=production. Pass --allow-production if you intend to write to live.',
    )
    process.exit(1)
  }
}

function parseBookingHawkDate(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  const parsed = Date.parse(`${trimmed} UTC`)
  if (!Number.isFinite(parsed)) return null

  return new Date(parsed).toISOString().slice(0, 10)
}

function isNoExpiry(value: string | undefined): boolean {
  const trimmed = value?.trim().toLowerCase() ?? ''
  return !trimmed || trimmed === 'no expiry'
}

function expirationIsoTimestamp(dateOnly: string): string {
  return new Date(`${dateOnly}T23:59:59.999Z`).toISOString()
}

function isExpirationInPast(dateOnly: string): boolean {
  return new Date(`${dateOnly}T23:59:59.999Z`) <= new Date()
}

function toDateOnly(isoOrDate: string | null | undefined): string | null {
  if (!isoOrDate) return null
  const d = new Date(isoOrDate)
  if (!Number.isFinite(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

async function getAdminReq(payload: Awaited<ReturnType<typeof getPayload>>) {
  const superAdmins = await payload.find({
    collection: 'users',
    where: { role: { contains: 'super-admin' } } as never,
    limit: 1,
    overrideAccess: true,
  } as never)
  let user = superAdmins.docs[0] ?? null
  if (!user) {
    const orgAdmins = await payload.find({
      collection: 'users',
      where: { role: { contains: 'admin' } } as never,
      limit: 1,
      overrideAccess: true,
    } as never)
    user = orgAdmins.docs[0] ?? null
  }
  if (!user || !checkRole(['super-admin', 'admin'], user as unknown as User)) {
    console.error('❌ No super-admin or org admin user found. Create one first.')
    process.exit(1)
  }

  return createLocalReq({ user: { ...user, collection: 'users' } as never }, payload)
}

async function resolveTenantId(
  payload: Awaited<ReturnType<typeof getPayload>>,
  args: Args,
): Promise<number> {
  if (args.tenantId) return Number(args.tenantId)

  if (!args.tenantSlug) {
    console.error('❌ Provide --tenant-id or --tenant-slug')
    process.exit(1)
  }

  const res = await payload.find({
    collection: 'tenants',
    where: { slug: { equals: args.tenantSlug } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const tenant = res.docs[0]
  if (!tenant?.id) {
    console.error(`❌ Tenant not found for slug "${args.tenantSlug}"`)
    process.exit(1)
  }
  return Number(tenant.id)
}

function tenantReq(
  req: Awaited<ReturnType<typeof createLocalReq>>,
  tenantId: number,
) {
  return {
    ...req,
    context: { ...req.context, tenant: tenantId },
  }
}

async function findPassByTransactionId(
  payload: Awaited<ReturnType<typeof getPayload>>,
  tenantId: number,
  transactionId: string,
): Promise<ClassPassDoc | null> {
  const res = await payload.find({
    collection: CLASS_PASSES as never,
    where: {
      and: [
        { tenant: { equals: tenantId } },
        { transactionId: { equals: transactionId } },
      ],
    } as never,
    limit: 1,
    depth: 0,
    overrideAccess: true,
  } as never)

  const doc = res.docs[0] as ClassPassDoc | undefined
  return doc?.id != null ? doc : null
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  blockInProductionUnlessAllowed(args.allowProduction)

  if (!process.env.DATABASE_URI?.trim()) {
    console.error('❌ DATABASE_URI is required')
    process.exit(1)
  }
  if (!process.env.PAYLOAD_SECRET?.trim()) {
    console.error('❌ PAYLOAD_SECRET is required')
    process.exit(1)
  }

  let source: SourceFile
  try {
    source = JSON.parse(readFileSync(args.inputPath, 'utf8')) as SourceFile
  } catch (err) {
    console.error(`❌ Could not read input at ${args.inputPath}:`, err)
    process.exit(1)
  }

  const rows = source.creditBundleSearchResults ?? []
  if (rows.length === 0) {
    console.error('❌ No creditBundleSearchResults found in input')
    process.exit(1)
  }

  const payload = await getPayload()
  const req = await getAdminReq(payload)
  const tenantId = await resolveTenantId(payload, args)

  const tenant = await payload.findByID({
    collection: 'tenants',
    id: tenantId,
    depth: 0,
    overrideAccess: true,
  } as never)

  console.log(
    `Repairing class-pass expiries from ${args.inputPath} → tenant "${(tenant as { name?: string; slug?: string }).name ?? tenantId}" (${(tenant as { slug?: string }).slug ?? tenantId})`,
  )
  if (args.dryRun) console.log('DRY RUN — no writes will be made')

  let updated = 0
  let unchanged = 0
  let skippedNoExpiry = 0
  let skippedMissing = 0
  let skippedParse = 0
  let failed = 0
  let wouldExpire = 0

  for (const row of rows) {
    const publicRef = row.publicReference?.trim()
    if (!publicRef) {
      skippedParse++
      continue
    }

    const label = `transactionId=${publicRef}`

    if (isNoExpiry(row.expiryDate)) {
      skippedNoExpiry++
      console.log(`skip  ${label}: source expiry is "no expiry" (leave 5y fallback)`)
      continue
    }

    const newDateOnly = parseBookingHawkDate(row.expiryDate)
    if (!newDateOnly) {
      skippedParse++
      console.error(`fail  ${label}: could not parse expiryDate "${row.expiryDate}"`)
      continue
    }

    try {
      const pass = await findPassByTransactionId(payload, tenantId, publicRef)
      if (!pass) {
        skippedMissing++
        continue
      }

      const currentDateOnly = toDateOnly(pass.expirationDate)
      const newExpirationIso = expirationIsoTimestamp(newDateOnly)
      const shouldExpire =
        isExpirationInPast(newDateOnly) && pass.status === 'active'
      const expiryChanged = currentDateOnly !== newDateOnly
      const statusChanged = shouldExpire

      if (!expiryChanged && !statusChanged) {
        unchanged++
        continue
      }

      if (shouldExpire) wouldExpire++

      const data: { expirationDate: string; status?: 'expired' } = {
        expirationDate: newExpirationIso,
      }
      if (shouldExpire) data.status = 'expired'

      if (args.dryRun) {
        console.log(
          `update ${label}: id=${pass.id} exp ${currentDateOnly ?? '?'} → ${newDateOnly}${shouldExpire ? ' + status active→expired' : ''}`,
        )
        updated++
        continue
      }

      await payload.update({
        collection: CLASS_PASSES as never,
        id: pass.id,
        data,
        req: tenantReq(req, tenantId),
        overrideAccess: true,
      } as never)

      console.log(
        `update ${label}: id=${pass.id} exp ${currentDateOnly ?? '?'} → ${newDateOnly}${shouldExpire ? ' + status active→expired' : ''}`,
      )
      updated++
    } catch (err) {
      failed++
      console.error(`fail  ${label}:`, err)
    }
  }

  console.log('')
  console.log(
    `Done. updated=${updated} unchanged=${unchanged} skippedNoExpiry=${skippedNoExpiry} notInDb=${skippedMissing} badDate=${skippedParse} failed=${failed} wouldExpire=${wouldExpire}${args.dryRun ? ' (dry-run)' : ''}`,
  )
}

main().catch((err) => {
  console.error('❌', err)
  process.exit(1)
})
