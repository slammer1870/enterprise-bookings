#!/usr/bin/env tsx
/**
 * Consume first-booking (trial) eligibility for returning customers.
 *
 * Uses Postgres directly (not Payload Local API) so it still works when the
 * deployed DB schema is slightly behind the current Payload config.
 *
 * BookingHawk / legacy exports often only include booker display names. This script:
 * 1. Reads unique "Booked By" names from a bookings CSV
 * 2. Resolves each name → email via a contacts CSV (first + last name)
 * 3. Finds the atnd-me user by email
 * 4. Creates one confirmed booking on a shared past "legacy import" timeslot
 *    when the user has no confirmed booking for the tenant yet
 *
 * That marks them non-trialable (`hasConfirmedBookingForTenant`).
 *
 * Usage (from apps/atnd-me):
 *   DATABASE_URI=... \
 *   pnpm exec tsx scripts/import-legacy-trial-bookings-from-csv.ts \
 *     --bookings-csv /path/to/983-events-bookings.csv \
 *     --contacts-csv /path/to/983-client-contact-data.csv \
 *     --tenant-slug fourwellness \
 *     --dry-run
 *
 * Live:
 *   NODE_ENV=production DATABASE_URI=... \
 *   pnpm exec tsx scripts/import-legacy-trial-bookings-from-csv.ts \
 *     --bookings-csv /path/to/983-events-bookings.csv \
 *     --contacts-csv /path/to/983-client-contact-data.csv \
 *     --tenant-slug fourwellness \
 *     --allow-production
 */

import 'dotenv/config'

import { readFileSync } from 'node:fs'

import { Pool, type PoolClient } from 'pg'

const LEGACY_EVENT_TYPE_NAME = 'Legacy migration (trial consumed)'
const LEGACY_TIMESLOT_LOCATION = 'legacy-trial-import'
const LEGACY_SLOT_DATE = '2024-01-01'
const LEGACY_SLOT_START = '2024-01-01T10:00:00.000Z'
const LEGACY_SLOT_END = '2024-01-01T11:00:00.000Z'

type Args = {
  bookingsCsvPath: string
  contactsCsvPath: string
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
  const bookingsCsvPath = readArg(argv, '--bookings-csv')
  const contactsCsvPath = readArg(argv, '--contacts-csv')

  if (!bookingsCsvPath) {
    console.error('❌ Provide --bookings-csv /path/to/events-bookings.csv')
    process.exit(1)
  }
  if (!contactsCsvPath) {
    console.error('❌ Provide --contacts-csv /path/to/client-contact-data.csv')
    process.exit(1)
  }

  return {
    bookingsCsvPath,
    contactsCsvPath,
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

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[\s_-]+/g, '')
}

function normalizeName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
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

function parseCsvRows(content: string): { headers: string[]; rows: string[][] } {
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
  const rows = lines.slice(1).map(parseCsvLine)
  return { headers, rows }
}

function colIndex(headers: string[], ...candidates: string[]): number {
  for (const c of candidates) {
    const i = headers.indexOf(c)
    if (i >= 0) return i
  }
  return -1
}

function uniqueBookerNames(bookingsCsv: string): string[] {
  const { headers, rows } = parseCsvRows(bookingsCsv)
  const bookedByIdx = colIndex(headers, 'bookedby', 'bookedbyname', 'customer', 'name')
  if (bookedByIdx < 0) {
    console.error('❌ Bookings CSV must include a "Booked By" column')
    process.exit(1)
  }

  const names = new Set<string>()
  for (const cols of rows) {
    const name = cols[bookedByIdx]?.trim()
    if (!name) continue
    if (normalizeName(name) === 'anonymous customer') continue
    names.add(name)
  }
  return [...names].sort((a, b) => a.localeCompare(b))
}

/** Map normalized full name → set of emails from contacts CSV. */
function buildContactEmailIndex(contactsCsv: string): Map<string, Set<string>> {
  const { headers, rows } = parseCsvRows(contactsCsv)
  const emailIdx = headers.findIndex(
    (h) => h === 'email' || h === 'emailaddress' || h.endsWith('email'),
  )
  const firstIdx = headers.findIndex(
    (h) =>
      h === 'firstname' ||
      h === 'first' ||
      h.includes('firstname') ||
      h.endsWith('first'),
  )
  const lastIdx = headers.findIndex(
    (h) =>
      h === 'lastname' ||
      h === 'last' ||
      h === 'surname' ||
      h.includes('lastname') ||
      h.endsWith('last'),
  )

  if (emailIdx < 0 || firstIdx < 0 || lastIdx < 0) {
    console.error(
      '❌ Contacts CSV must include Email + Client First Name + Client Last Name columns',
    )
    process.exit(1)
  }

  const index = new Map<string, Set<string>>()
  for (const cols of rows) {
    const email = cols[emailIdx]?.trim().toLowerCase()
    if (!email || !email.includes('@')) continue
    const first = cols[firstIdx]?.trim() ?? ''
    const last = cols[lastIdx]?.trim() ?? ''
    const full = normalizeName(`${first} ${last}`)
    if (!full) continue
    let set = index.get(full)
    if (!set) {
      set = new Set()
      index.set(full, set)
    }
    set.add(email)
  }
  return index
}

async function resolveTenantId(client: PoolClient, args: Args): Promise<number> {
  if (args.tenantId) return Number(args.tenantId)
  if (!args.tenantSlug) {
    console.error('❌ Provide --tenant-id or --tenant-slug')
    process.exit(1)
  }
  const res = await client.query<{ id: number; name: string; slug: string }>(
    `select id, name, slug from tenants where slug = $1 limit 1`,
    [args.tenantSlug],
  )
  const row = res.rows[0]
  if (!row) {
    console.error(`❌ Tenant not found for slug "${args.tenantSlug}"`)
    process.exit(1)
  }
  console.log(`Tenant: "${row.name}" (${row.slug}) id=${row.id}`)
  return Number(row.id)
}

async function ensureLegacyEventType(
  client: PoolClient,
  tenantId: number,
  dryRun: boolean,
): Promise<number> {
  const existing = await client.query<{ id: number }>(
    `select id from event_types where tenant_id = $1 and name = $2 limit 1`,
    [tenantId, LEGACY_EVENT_TYPE_NAME],
  )
  if (existing.rows[0]?.id != null) return Number(existing.rows[0].id)

  if (dryRun) {
    console.log(`would create event-type "${LEGACY_EVENT_TYPE_NAME}"`)
    return -1
  }

  const created = await client.query<{ id: number }>(
    `insert into event_types (name, places, description, tenant_id, updated_at, created_at)
     values ($1, $2, $3, $4, now(), now())
     returning id`,
    [
      LEGACY_EVENT_TYPE_NAME,
      9999,
      'Internal placeholder used only to record pre-migration bookings so returning customers are not offered the first-booking trial discount.',
      tenantId,
    ],
  )
  const id = Number(created.rows[0]!.id)
  console.log(`created event-type id=${id} "${LEGACY_EVENT_TYPE_NAME}"`)
  return id
}

async function ensureLegacyTimeslot(
  client: PoolClient,
  tenantId: number,
  eventTypeId: number,
  dryRun: boolean,
): Promise<number> {
  const existing = await client.query<{ id: number }>(
    `select id from timeslots where tenant_id = $1 and location = $2 limit 1`,
    [tenantId, LEGACY_TIMESLOT_LOCATION],
  )
  if (existing.rows[0]?.id != null) return Number(existing.rows[0].id)

  if (dryRun) {
    console.log(`would create timeslot location=${LEGACY_TIMESLOT_LOCATION} date=${LEGACY_SLOT_DATE}`)
    return -1
  }

  if (eventTypeId <= 0) {
    console.error('❌ Cannot create timeslot without event type id')
    process.exit(1)
  }

  const created = await client.query<{ id: number }>(
    `insert into timeslots (
       date, start_time, end_time, lock_out_time, original_lock_out_time,
       location, event_type_id, active, tenant_id, updated_at, created_at
     ) values (
       $1::timestamptz, $2::timestamptz, $3::timestamptz, 0, 0,
       $4, $5, false, $6, now(), now()
     )
     returning id`,
    [LEGACY_SLOT_DATE, LEGACY_SLOT_START, LEGACY_SLOT_END, LEGACY_TIMESLOT_LOCATION, eventTypeId, tenantId],
  )
  const id = Number(created.rows[0]!.id)
  console.log(`created timeslot id=${id} location=${LEGACY_TIMESLOT_LOCATION}`)
  return id
}

async function findUsersByEmails(
  client: PoolClient,
  emails: string[],
  tenantId: number,
): Promise<Array<{ id: number; email: string; onTenant: boolean }>> {
  if (emails.length === 0) return []
  const res = await client.query<{ id: number; email: string; on_tenant: boolean }>(
    `select u.id,
            lower(u.email) as email,
            exists (
              select 1 from users_tenants ut
              where ut._parent_id = u.id and ut.tenant_id = $2
            ) as on_tenant
     from users u
     where lower(u.email) = any($1::text[])`,
    [emails.map((e) => e.toLowerCase()), tenantId],
  )
  return res.rows.map((r) => ({
    id: Number(r.id),
    email: String(r.email),
    onTenant: Boolean(r.on_tenant),
  }))
}

/**
 * Resolve candidate users for a booker name.
 * - Prefer tenant members when multiple emails match.
 * - If several tenant members remain, return all of them (safer: consume trial
 *   on every plausible account rather than leave returning customers trialable).
 */
function pickUsers(
  candidates: Array<{ id: number; email: string; onTenant: boolean }>,
): Array<{ id: number; email: string }> {
  if (candidates.length === 0) return []
  const unique = new Map<number, { id: number; email: string; onTenant: boolean }>()
  for (const u of candidates) unique.set(u.id, u)
  const all = [...unique.values()]
  if (all.length === 1) return [{ id: all[0]!.id, email: all[0]!.email }]
  const onTenant = all.filter((u) => u.onTenant)
  if (onTenant.length > 0) return onTenant.map((u) => ({ id: u.id, email: u.email }))
  // No tenant membership yet — still return all matched accounts so trial is consumed.
  return all.map((u) => ({ id: u.id, email: u.email }))
}

async function userHasConfirmedBooking(
  client: PoolClient,
  tenantId: number,
  userId: number,
): Promise<boolean> {
  const res = await client.query<{ ok: number }>(
    `select 1 as ok from bookings
     where tenant_id = $1 and user_id = $2 and status = 'confirmed'
     limit 1`,
    [tenantId, userId],
  )
  return res.rows.length > 0
}

async function createConfirmedBooking(
  client: PoolClient,
  args: { tenantId: number; userId: number; timeslotId: number },
): Promise<number> {
  const res = await client.query<{ id: number }>(
    `insert into bookings (
       user_id, timeslot_id, status, tenant_id, created_at, updated_at
     ) values (
       $1, $2, 'confirmed', $3, $4::timestamptz, now()
     )
     returning id`,
    [args.userId, args.timeslotId, args.tenantId, LEGACY_SLOT_START],
  )
  return Number(res.rows[0]!.id)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  blockInProductionUnlessAllowed(args.allowProduction)

  const databaseUri = process.env.DATABASE_URI?.trim()
  if (!databaseUri) {
    console.error('❌ DATABASE_URI is required')
    process.exit(1)
  }

  let bookingsContent: string
  let contactsContent: string
  try {
    bookingsContent = readFileSync(args.bookingsCsvPath, 'utf8')
  } catch (err) {
    console.error(`❌ Could not read bookings CSV at ${args.bookingsCsvPath}:`, err)
    process.exit(1)
  }
  try {
    contactsContent = readFileSync(args.contactsCsvPath, 'utf8')
  } catch (err) {
    console.error(`❌ Could not read contacts CSV at ${args.contactsCsvPath}:`, err)
    process.exit(1)
  }

  const bookerNames = uniqueBookerNames(bookingsContent)
  const contactIndex = buildContactEmailIndex(contactsContent)

  const pool = new Pool({
    connectionString: databaseUri,
    ssl: databaseUri.includes('sslmode=') ? undefined : { rejectUnauthorized: false },
  })
  const client = await pool.connect()

  try {
    const tenantId = await resolveTenantId(client, args)
    console.log(`Unique bookers in CSV: ${bookerNames.length}`)
    if (args.dryRun) console.log('DRY RUN — no writes will be made')

    const eventTypeId = await ensureLegacyEventType(client, tenantId, args.dryRun)
    const timeslotId = await ensureLegacyTimeslot(client, tenantId, eventTypeId, args.dryRun)

    let created = 0
    let alreadyHad = 0
    let skippedNoContact = 0
    let skippedNoUser = 0
    let skippedDuplicateEmail = 0
    let multiResolved = 0
    let failed = 0

    const processedUserIds = new Set<number>()
    const processedEmails = new Set<string>()

    for (const name of bookerNames) {
      const key = normalizeName(name)
      const emails = [...(contactIndex.get(key) ?? new Set())].filter(Boolean)

      if (emails.length === 0) {
        skippedNoContact++
        console.log(`skip  no-contact: ${name}`)
        continue
      }

      let existingUsers: Array<{ id: number; email: string; onTenant: boolean }>
      try {
        existingUsers = await findUsersByEmails(client, emails, tenantId)
      } catch (err) {
        failed++
        console.error(`fail  lookup ${name}:`, err)
        continue
      }

      const chosenUsers = pickUsers(existingUsers)
      if (chosenUsers.length === 0) {
        skippedNoUser++
        console.log(`skip  no-user: ${name} → ${emails.join(', ')}`)
        continue
      }
      if (chosenUsers.length > 1) {
        multiResolved++
        console.log(
          `multi  ${name} → ${chosenUsers.map((u) => u.email).join(', ')} (creating for all)`,
        )
      }

      for (const chosen of chosenUsers) {
        if (processedUserIds.has(chosen.id) || processedEmails.has(chosen.email.toLowerCase())) {
          skippedDuplicateEmail++
          console.log(`skip  duplicate: ${name} → ${chosen.email}`)
          continue
        }
        processedUserIds.add(chosen.id)
        processedEmails.add(chosen.email.toLowerCase())

        try {
          const hasBooking = await userHasConfirmedBooking(client, tenantId, chosen.id)
          if (hasBooking) {
            alreadyHad++
            console.log(`skip  already-confirmed: ${name} → ${chosen.email} (user ${chosen.id})`)
            continue
          }

          if (args.dryRun) {
            created++
            console.log(`create ${name} → ${chosen.email} (user ${chosen.id})`)
            continue
          }

          if (timeslotId <= 0) {
            console.error('❌ Missing timeslot id')
            process.exit(1)
          }

          const bookingId = await createConfirmedBooking(client, {
            tenantId,
            userId: chosen.id,
            timeslotId,
          })
          created++
          console.log(`create ${name} → ${chosen.email} (user ${chosen.id}) booking=${bookingId}`)
        } catch (err) {
          failed++
          console.error(`fail  ${name} → ${chosen.email}:`, err)
        }
      }
    }

    console.log('')
    console.log(
      [
        `Done. created=${created}`,
        `alreadyHad=${alreadyHad}`,
        `skippedNoContact=${skippedNoContact}`,
        `skippedNoUser=${skippedNoUser}`,
        `skippedDuplicateEmail=${skippedDuplicateEmail}`,
        `multiResolved=${multiResolved}`,
        `failed=${failed}`,
        args.dryRun ? '(dry-run)' : '',
      ]
        .filter(Boolean)
        .join(' '),
    )
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((err) => {
  console.error('❌', err)
  process.exit(1)
})
