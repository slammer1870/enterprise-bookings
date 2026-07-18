#!/usr/bin/env tsx
/**
 * Phase 2 — Import class passes from transformed BookingHawk JSON into atnd-me.
 *
 * Reads class-passes-import.json (from transform-bookinghawk-bundles.ts), resolves or
 * creates class pass types and users, and creates class-passes records.
 *
 * Usage (from apps/atnd-me):
 *   DATABASE_URI=... PAYLOAD_SECRET=... \
 *   pnpm exec tsx scripts/import-class-passes-from-json.ts \
 *     --json /path/to/class-passes-import.json \
 *     --tenant-slug my-tenant \
 *     --dry-run
 *
 * Live database (requires explicit opt-in):
 *   NODE_ENV=production DATABASE_URI=... PAYLOAD_SECRET=... \
 *   pnpm exec tsx scripts/import-class-passes-from-json.ts \
 *     --json /path/to/class-passes-import.json \
 *     --tenant-slug my-tenant \
 *     --allow-production
 */

import 'dotenv/config'

import { readFileSync } from 'node:fs'

import { createLocalReq } from 'payload'
import { checkRole } from '@repo/shared-utils'
import type { User } from '@repo/shared-types'

import { getPayload } from '@/lib/payload'
import type { ClassPassImportFile, ClassPassImportRow } from './transform-bookinghawk-bundles'

const CLASS_PASS_TYPES = 'class-pass-types'
const CLASS_PASSES = 'class-passes'
const DAYS_UNTIL_EXPIRATION = 1825 // 5 years

type Args = {
  jsonPath: string
  tenantId?: string
  tenantSlug?: string
  dryRun: boolean
  allowProduction: boolean
}

function readArg(argv: string[], name: string): string | undefined {
  const eq = argv.find((a) => a.startsWith(`${name}=`))
  if (eq) return eq.split('=').slice(1).join('=')
  const i = argv.indexOf(name)
  return i >= 0 ? argv[i + 1] : undefined
}

function parseArgs(argv: string[]): Args {
  const jsonPath = readArg(argv, '--json')

  if (!jsonPath) {
    console.error('❌ Provide --json /path/to/class-passes-import.json')
    process.exit(1)
  }

  return {
    jsonPath,
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

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}

function expirationIsoTimestamp(dateOnly: string): string {
  return new Date(`${dateOnly}T23:59:59.999Z`).toISOString()
}

function isExpirationInPast(dateOnly: string): boolean {
  const exp = new Date(`${dateOnly}T23:59:59.999Z`)
  return exp <= new Date()
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

async function findClassPassTypeId(
  payload: Awaited<ReturnType<typeof getPayload>>,
  tenantId: number,
  passTypeName: string,
): Promise<number | null> {
  const res = await payload.find({
    collection: CLASS_PASS_TYPES as never,
    where: {
      and: [
        { tenant: { equals: tenantId } },
        { name: { equals: passTypeName } },
        { deletedAt: { equals: null } },
      ],
    } as never,
    limit: 1,
    depth: 0,
    overrideAccess: true,
  } as never)

  const doc = res.docs[0]
  return doc?.id != null ? Number(doc.id) : null
}

async function ensureClassPassType(
  payload: Awaited<ReturnType<typeof getPayload>>,
  req: Awaited<ReturnType<typeof createLocalReq>>,
  tenantId: number,
  row: ClassPassImportRow,
  dryRun: boolean,
  cache: Map<string, number>,
): Promise<number> {
  const cached = cache.get(row.passTypeName)
  if (cached != null) return cached

  const existingId = await findClassPassTypeId(payload, tenantId, row.passTypeName)
  if (existingId != null) {
    cache.set(row.passTypeName, existingId)
    return existingId
  }

  if (dryRun) {
    const placeholder = -(cache.size + 1)
    cache.set(row.passTypeName, placeholder)
    return placeholder
  }

  const created = await payload.create({
    collection: CLASS_PASS_TYPES as never,
    data: {
      tenant: tenantId,
      name: row.passTypeName,
      quantity: row.passTypeQuantity,
      daysUntilExpiration: DAYS_UNTIL_EXPIRATION,
      status: 'inactive',
      skipSync: true,
    },
    req: tenantReq(req, tenantId),
    overrideAccess: true,
  } as never)

  const id = Number(created.id)
  cache.set(row.passTypeName, id)
  return id
}

async function findUsersByNormalizedName(
  payload: Awaited<ReturnType<typeof getPayload>>,
  customerName: string,
): Promise<Array<{ id: number; name?: string | null }>> {
  const target = normalizeName(customerName)
  if (!target) return []

  const res = await payload.find({
    collection: 'users',
    limit: 5000,
    depth: 0,
    overrideAccess: true,
  } as never)

  return res.docs.filter((doc) => {
    const name = (doc as { name?: string | null }).name
    return typeof name === 'string' && normalizeName(name) === target
  }) as Array<{ id: number; name?: string | null }>
}

async function findExistingPassByTransactionId(
  payload: Awaited<ReturnType<typeof getPayload>>,
  tenantId: number,
  transactionId: string,
): Promise<number | null> {
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

  const doc = res.docs[0]
  return doc?.id != null ? Number(doc.id) : null
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

  let importFile: ClassPassImportFile
  try {
    importFile = JSON.parse(readFileSync(args.jsonPath, 'utf8')) as ClassPassImportFile
  } catch (err) {
    console.error(`❌ Could not read JSON at ${args.jsonPath}:`, err)
    process.exit(1)
  }

  const rows = importFile.classPassImports ?? []
  if (rows.length === 0) {
    console.error('❌ No classPassImports found in JSON')
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
    `Importing ${rows.length} class pass(es) → tenant "${(tenant as { name?: string; slug?: string }).name ?? tenantId}" (${(tenant as { slug?: string }).slug ?? tenantId})`,
  )
  if (args.dryRun) console.log('DRY RUN — no writes will be made')

  const typeCache = new Map<string, number>()
  let created = 0
  let skipped = 0
  let failed = 0

  for (const row of rows) {
    const label = `transactionId=${row.transactionId}`

    try {
      if (!row.customerName?.trim()) {
        failed++
        console.error(`fail  ${label}: missing customerName`)
        continue
      }

      if (isExpirationInPast(row.expirationDate)) {
        skipped++
        console.log(`skip  ${label}: expiration ${row.expirationDate} is in the past`)
        continue
      }

      const existingPassId = await findExistingPassByTransactionId(
        payload,
        tenantId,
        row.transactionId,
      )
      if (existingPassId != null) {
        skipped++
        console.log(`skip  ${label}: already imported (class-pass id ${existingPassId})`)
        continue
      }

      const users = await findUsersByNormalizedName(payload, row.customerName)
      if (users.length === 0) {
        failed++
        console.error(`fail  ${label}: no user matching name "${row.customerName}"`)
        continue
      }
      if (users.length > 1) {
        failed++
        console.error(
          `fail  ${label}: ambiguous name "${row.customerName}" (${users.length} matches: ${users.map((u) => u.id).join(', ')})`,
        )
        continue
      }

      const userId = Number(users[0]!.id)
      const typeId = await ensureClassPassType(
        payload,
        req,
        tenantId,
        row,
        args.dryRun,
        typeCache,
      )

      if (args.dryRun) {
        console.log(
          `create ${label}: user=${userId} type=${typeId} qty=${row.quantity} exp=${row.expirationDate}`,
        )
        created++
        continue
      }

      await payload.create({
        collection: CLASS_PASSES as never,
        data: {
          tenant: tenantId,
          user: userId,
          type: typeId,
          quantity: row.quantity,
          purchasedAt: row.purchasedAt,
          expirationDate: expirationIsoTimestamp(row.expirationDate),
          status: row.status,
          transactionId: row.transactionId,
          notes: row.notes,
        },
        req: tenantReq(req, tenantId),
        overrideAccess: true,
      } as never)

      console.log(`create ${label}: user=${userId} type=${typeId} qty=${row.quantity}`)
      created++
    } catch (err) {
      failed++
      console.error(`fail  ${label}:`, err)
    }
  }

  console.log('')
  console.log(
    `Done. created=${created} skipped=${skipped} failed=${failed}${args.dryRun ? ' (dry-run)' : ''}`,
  )
}

main().catch((err) => {
  console.error('❌', err)
  process.exit(1)
})
