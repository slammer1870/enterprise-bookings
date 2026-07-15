#!/usr/bin/env tsx
/**
 * Bulk-register users from a CSV file into atnd-me.
 *
 * Expected columns (header row required; names are case-insensitive):
 *   - email (required)
 *   - first name + last name, OR a single `name` column
 *
 * Users are created passwordlessly (random password) and assigned to the target tenant
 * via `registrationTenant` + `tenants` membership — same as normal sign-up.
 *
 * Existing users (matched by email) are skipped by default; use `--upsert` to add the
 * tenant membership without changing their name or roles.
 *
 * Usage (from apps/atnd-me):
 *   DATABASE_URI=... PAYLOAD_SECRET=... \
 *   pnpm exec tsx scripts/import-users-from-csv.ts \
 *     --csv /path/to/users.csv \
 *     --tenant-slug my-tenant \
 *     --dry-run
 *
 * Live database (requires explicit opt-in):
 *   NODE_ENV=production DATABASE_URI=... PAYLOAD_SECRET=... \
 *   pnpm exec tsx scripts/import-users-from-csv.ts \
 *     --csv /path/to/users.csv \
 *     --tenant-slug my-tenant \
 *     --allow-production
 */

import 'dotenv/config'

import { readFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'

import { createLocalReq } from 'payload'
import { checkRole } from '@repo/shared-utils'
import type { User } from '@repo/shared-types'

import { getPayload } from '@/lib/payload'

type Args = {
  csvPath: string
  tenantId?: string
  tenantSlug?: string
  dryRun: boolean
  upsert: boolean
  allowProduction: boolean
}

type CsvRow = {
  email: string
  name: string
  line: number
}

function readArg(argv: string[], name: string): string | undefined {
  const eq = argv.find((a) => a.startsWith(`${name}=`))
  if (eq) return eq.split('=').slice(1).join('=')
  const i = argv.indexOf(name)
  return i >= 0 ? argv[i + 1] : undefined
}

function parseArgs(argv: string[]): Args {
  const csvArg = readArg(argv, '--csv')

  if (!csvArg) {
    console.error('❌ Provide --csv /path/to/file.csv')
    process.exit(1)
  }

  return {
    csvPath: csvArg,
    tenantId: readArg(argv, '--tenant-id'),
    tenantSlug: readArg(argv, '--tenant-slug'),
    dryRun: argv.includes('--dry-run'),
    upsert: argv.includes('--upsert'),
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

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[\s_-]+/g, '')
}

function parseCsv(content: string): CsvRow[] {
  const lines = content
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  if (lines.length < 2) {
    console.error('❌ CSV must include a header row and at least one data row')
    process.exit(1)
  }

  const headers = parseCsvLine(lines[0]!).map(normalizeHeader)
  const emailIdx = headers.findIndex(
    (h) => h === 'email' || h === 'emailaddress' || h.endsWith('email'),
  )
  const nameIdx = headers.findIndex(
    (h) =>
      h === 'name' ||
      h === 'fullname' ||
      (h.endsWith('name') && !h.includes('first') && !h.includes('last')),
  )
  const firstIdx = headers.findIndex(
    (h) =>
      h === 'firstname' ||
      h === 'first' ||
      h.endsWith('firstname') ||
      h.endsWith('first') ||
      h.includes('firstname'),
  )
  const lastIdx = headers.findIndex(
    (h) =>
      h === 'lastname' ||
      h === 'last' ||
      h === 'surname' ||
      h.endsWith('lastname') ||
      h.endsWith('last') ||
      h.includes('lastname'),
  )

  if (emailIdx < 0) {
    console.error('❌ CSV must include an `email` column')
    process.exit(1)
  }
  if (nameIdx < 0 && (firstIdx < 0 || lastIdx < 0)) {
    console.error('❌ CSV must include `name` or both `first name` and `last name` columns')
    process.exit(1)
  }

  const rows: CsvRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]!)
    const email = cols[emailIdx]?.trim().toLowerCase()
    if (!email) {
      console.warn(`⚠️  Line ${i + 1}: skipping row with missing email`)
      continue
    }

    let name = ''
    if (firstIdx >= 0 && lastIdx >= 0) {
      const first = cols[firstIdx]?.trim() ?? ''
      const last = cols[lastIdx]?.trim() ?? ''
      name = [first, last].filter(Boolean).join(' ').trim()
    } else if (nameIdx >= 0) {
      name = cols[nameIdx]?.trim() ?? ''
    } else if (firstIdx >= 0) {
      name = cols[firstIdx]?.trim() ?? ''
    } else if (lastIdx >= 0) {
      name = cols[lastIdx]?.trim() ?? ''
    }

    if (!name) {
      name = email.split('@')[0] ?? `User ${i}`
      console.warn(`⚠️  Line ${i + 1}: missing name for ${email}, using "${name}"`)
    }

    rows.push({ email, name, line: i + 1 })
  }

  return rows
}

/** Minimal RFC-style CSV line parser (handles quoted fields). */
function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += ch
      }
      continue
    }

    if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }

  out.push(cur)
  return out
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

async function ensureUserTenantMembership(
  payload: Awaited<ReturnType<typeof getPayload>>,
  req: Awaited<ReturnType<typeof createLocalReq>>,
  userId: number,
  tenantId: number,
): Promise<void> {
  const user = (await payload.findByID({
    collection: 'users',
    id: userId,
    depth: 1,
    overrideAccess: true,
  } as never)) as { tenants?: Array<{ tenant?: number | { id: number } }> } | null
  if (!user) return

  const rows = Array.isArray(user.tenants) ? user.tenants : []
  const tenantIds: number[] = []
  for (const row of rows) {
    const t = row?.tenant
    const tid =
      typeof t === 'object' && t !== null && 'id' in t
        ? Number((t as { id: number }).id)
        : Number(t)
    if (Number.isFinite(tid) && !tenantIds.includes(tid)) tenantIds.push(tid)
  }
  if (tenantIds.includes(tenantId)) return

  await payload.update({
    collection: 'users',
    id: userId,
    data: {
      tenants: [...tenantIds.map((tid) => ({ tenant: tid })), { tenant: tenantId }],
    },
    req,
    overrideAccess: true,
  } as never)
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

  let csvContent: string
  try {
    csvContent = readFileSync(args.csvPath, 'utf8')
  } catch (err) {
    console.error(`❌ Could not read CSV at ${args.csvPath}:`, err)
    process.exit(1)
  }

  const rows = parseCsv(csvContent)
  if (rows.length === 0) {
    console.error('❌ No valid rows found in CSV')
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
    `Importing ${rows.length} user(s) → tenant "${(tenant as { name?: string; slug?: string }).name ?? tenantId}" (${(tenant as { slug?: string }).slug ?? tenantId})`,
  )
  if (args.dryRun) console.log('DRY RUN — no writes will be made')

  let created = 0
  let upserted = 0
  let skipped = 0
  let failed = 0

  for (const row of rows) {
    try {
      const existing = await payload.find({
        collection: 'users',
        where: { email: { equals: row.email } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })

      const existingUser = existing.docs[0]
      if (existingUser) {
        if (!args.upsert) {
          console.log(`skip  line ${row.line}: ${row.email} (already exists)`)
          skipped++
          continue
        }

        if (args.dryRun) {
          console.log(`upsert line ${row.line}: ${row.email} (would add tenant membership)`)
          upserted++
          continue
        }

        await ensureUserTenantMembership(payload, req, Number(existingUser.id), tenantId)
        console.log(`upsert line ${row.line}: ${row.email} (tenant membership ensured)`)
        upserted++
        continue
      }

      if (args.dryRun) {
        console.log(`create line ${row.line}: ${row.email} — ${row.name}`)
        created++
        continue
      }

      const password = randomBytes(24).toString('base64url')
      await payload.create({
        collection: 'users',
        data: {
          email: row.email,
          name: row.name,
          password,
          role: ['user'],
          emailVerified: false,
          registrationTenant: tenantId,
          tenants: [{ tenant: tenantId }],
        },
        req,
        overrideAccess: true,
      } as never)

      console.log(`create line ${row.line}: ${row.email} — ${row.name}`)
      created++
    } catch (err) {
      failed++
      console.error(`fail  line ${row.line}: ${row.email}:`, err)
    }
  }

  console.log('')
  console.log(
    `Done. created=${created} upserted=${upserted} skipped=${skipped} failed=${failed}${args.dryRun ? ' (dry-run)' : ''}`,
  )

  if (!args.dryRun && created > 0) {
    console.log('')
    console.log(
      'Users can sign in via magic link on the tenant site (Register/Login → email link).',
    )
  }
}

main().catch((err) => {
  console.error('❌', err)
  process.exit(1)
})
