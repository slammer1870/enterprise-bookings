#!/usr/bin/env tsx
/**
 * Import migrated gift vouchers as one-time amount_off DiscountCodes.
 *
 * Usage (from apps/atnd-me):
 *   DATABASE_URI=... PAYLOAD_SECRET=... \
 *   pnpm exec tsx scripts/import-discount-codes-from-json.ts \
 *     --json /path/to/gift-vouchers-import.json \
 *     --tenant-slug my-tenant \
 *     --dry-run
 *
 * Live database (requires explicit opt-in):
 *   NODE_ENV=production DATABASE_URI=... PAYLOAD_SECRET=... \
 *   pnpm exec tsx scripts/import-discount-codes-from-json.ts \
 *     --json /path/to/gift-vouchers-import.json \
 *     --tenant-slug my-tenant \
 *     --allow-production
 *
 * JSON shape:
 * {
 *   "giftVoucherImports": [
 *     {
 *       "externalId": "old-voucher-1",
 *       "code": "GIFT30",
 *       "remainingAmount": 30,
 *       "purchasedAt": "2024-06-01T00:00:00.000Z",
 *       "expiresAt": "optional-override",
 *       "customerName": "Jane Doe",
 *       "email": "jane@example.com",
 *       "notes": "optional"
 *     }
 *   ]
 * }
 */

import 'dotenv/config'

import { readFileSync } from 'node:fs'

import { createLocalReq } from 'payload'
import { checkRole } from '@repo/shared-utils'
import type { User } from '@repo/shared-types'

import { getPayload } from '@/lib/payload'
import { getTenantStripeContext } from '@/lib/stripe-connect/tenantStripe'
import {
  type GiftVoucherImportFile,
  type GiftVoucherImportRow,
  isValidGiftVoucherImportRow,
  resolveRedeemBy,
  resolveRootPurchasedAt,
  sanitizeDiscountCode,
} from '@/lib/stripe-connect/giftVoucherImport'

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
    console.error('❌ Provide --json /path/to/gift-vouchers-import.json')
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

async function findByExternalId(
  payload: Awaited<ReturnType<typeof getPayload>>,
  tenantId: number,
  externalId: string,
): Promise<number | null> {
  const res = await payload.find({
    collection: 'discount-codes',
    where: {
      and: [
        { tenant: { equals: tenantId } },
        { externalId: { equals: externalId } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const doc = res.docs[0]
  return doc?.id != null ? Number(doc.id) : null
}

async function findByCode(
  payload: Awaited<ReturnType<typeof getPayload>>,
  tenantId: number,
  code: string,
): Promise<number | null> {
  const res = await payload.find({
    collection: 'discount-codes',
    where: {
      and: [
        { tenant: { equals: tenantId } },
        { code: { equals: code } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const doc = res.docs[0]
  return doc?.id != null ? Number(doc.id) : null
}

function buildName(row: GiftVoucherImportRow): string {
  const who = row.customerName?.trim() || row.email?.trim() || row.externalId
  return `Migrated gift voucher – ${who}`
}

function buildNotes(row: GiftVoucherImportRow): string | undefined {
  const parts = [
    row.notes?.trim(),
    row.email ? `email=${row.email.trim()}` : null,
    `externalId=${row.externalId}`,
  ].filter(Boolean)
  return parts.length ? parts.join(' | ') : undefined
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

  let importFile: GiftVoucherImportFile
  try {
    importFile = JSON.parse(readFileSync(args.jsonPath, 'utf8')) as GiftVoucherImportFile
  } catch (err) {
    console.error(`❌ Could not read JSON at ${args.jsonPath}:`, err)
    process.exit(1)
  }

  const rows = importFile.giftVoucherImports ?? []
  if (rows.length === 0) {
    console.error('❌ No giftVoucherImports found in JSON')
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
  })

  const stripeCtx = getTenantStripeContext(tenant as never)
  if (!stripeCtx.isConnected && !args.dryRun) {
    console.error(
      '❌ Tenant Stripe Connect is not active. Discount codes must sync to Stripe for checkout validation.',
    )
    process.exit(1)
  }

  console.log(
    `Importing ${rows.length} gift voucher(s) as discount-codes → tenant "${(tenant as { name?: string; slug?: string }).name ?? tenantId}" (${(tenant as { slug?: string }).slug ?? tenantId})`,
  )
  if (args.dryRun) console.log('DRY RUN — no writes will be made')
  if (!stripeCtx.isConnected && args.dryRun) {
    console.log('WARN: tenant Connect not active (ok for dry-run)')
  }

  let created = 0
  let skipped = 0
  let failed = 0

  for (const row of rows) {
    const label = `externalId=${(row as GiftVoucherImportRow)?.externalId ?? '?'}`

    try {
      if (!isValidGiftVoucherImportRow(row)) {
        failed++
        console.error(`fail  ${label}: invalid row (need externalId + positive remainingAmount)`)
        continue
      }

      const existingByExt = await findByExternalId(payload, tenantId, row.externalId)
      if (existingByExt != null) {
        skipped++
        console.log(`skip  ${label}: already imported (discount-code id ${existingByExt})`)
        continue
      }

      const code = sanitizeDiscountCode(row.code ?? '', row.externalId)
      const existingByCode = await findByCode(payload, tenantId, code)
      if (existingByCode != null) {
        skipped++
        console.log(`skip  ${label}: code ${code} already exists (id ${existingByCode})`)
        continue
      }

      const rootPurchasedAt = resolveRootPurchasedAt(row)
      const redeemBy = resolveRedeemBy(row, rootPurchasedAt)
      const name = buildName(row)
      const notes = buildNotes(row)

      if (args.dryRun) {
        console.log(
          `create ${label}: code=${code} amount=${row.remainingAmount} rootPurchasedAt=${rootPurchasedAt.toISOString()} redeemBy=${redeemBy}`,
        )
        created++
        continue
      }

      const displayName = notes ? `${name} (${row.externalId})` : name

      const createdDoc = await payload.create({
        collection: 'discount-codes',
        data: {
          tenant: tenantId,
          name: displayName,
          code,
          type: 'amount_off',
          value: row.remainingAmount,
          currency: 'eur',
          duration: 'once',
          maxRedemptions: 1,
          rootPurchasedAt: rootPurchasedAt.toISOString(),
          redeemBy,
          externalId: row.externalId,
          status: 'active',
        },
        req: tenantReq(req, tenantId),
        overrideAccess: true,
      })

      console.log(
        `create ${label}: id=${createdDoc.id} code=${code} amount=${row.remainingAmount} redeemBy=${redeemBy}`,
      )
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
  console.log(
    'Deliver each code to the customer (email/CSV). One-time use; unused remainder on drop-ins is auto-transferred to a new code.',
  )
}

main().catch((err) => {
  console.error('❌', err)
  process.exit(1)
})
