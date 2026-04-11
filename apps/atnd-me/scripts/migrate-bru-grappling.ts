#!/usr/bin/env tsx
/**
 * One-off migration: standalone Payload app → atnd-me tenant (content + custom blocks).
 *
 * Supported sources (`--from`):
 * - `bru-grappling` (default): maps Bru page blocks to `bru*` slugs; source DB from
 *   `BRU_SOURCE_DATABASE_URI` or `SOURCE_DATABASE_URI`.
 * - `darkhorse-strength`: maps Dark Horse page blocks to tenant-scoped `dh*` slugs; source DB from
 *   `DH_SOURCE_DATABASE_URI`, `DARKHORSE_SOURCE_DATABASE_URI`, or `SOURCE_DATABASE_URI`.
 *
 * Migrated users get atnd-me role names: legacy `admin` → `super-admin`, `tenant-admin` → `admin`
 * (see migration `20260409000001_roles_data_and_booking_table_renames`).
 *
 * By default, **passwords are preserved** when the source DB has Payload `users.salt`/`users.hash`
 * (stored in target `accounts.password` as `salt:hash` for `@repo/auth-next` legacy PBKDF2 verify)
 * or an existing Better Auth `accounts` row for `credential` (scrypt hash copied as-is).
 * This does **not** depend on `PAYLOAD_SECRET` or `BETTER_AUTH_SECRET` matching the source app.
 * Use `--no-preserve-passwords` to force random (or `MIGRATION_DEFAULT_USER_PASSWORD`) passwords.
 *
 * This script is intentionally conservative:
 * - Supports --dry-run
 * - Requires an explicit tenant id or slug
 * - Creates records via Payload Local API (so hooks run)
 *
 * Usage (from apps/atnd-me):
 *   DATABASE_URI=... PAYLOAD_SECRET=... \
 *   BRU_SOURCE_DATABASE_URI=... \
 *   pnpm exec tsx scripts/migrate-bru-grappling.ts --tenant-slug bru-grappling --dry-run
 *
 * Dark Horse:
 *   DH_SOURCE_DATABASE_URI=... \
 *   pnpm exec tsx scripts/migrate-bru-grappling.ts --from darkhorse-strength --tenant-slug darkhorse-strength --dry-run
 *
 * Then run without --dry-run.
 */

import 'dotenv/config'

import { createLocalReq } from 'payload'
import { Pool } from 'pg'
import { randomBytes } from 'node:crypto'

import { getPayload } from '@/lib/payload'
import { allBlockSlugs, defaultBlockSlugs, extraBlockSlugs } from '@/blocks/registry'
import { getPlatformStripe } from '@/lib/stripe/platform'
import { getTenantStripeContext, type TenantStripeLike } from '@/lib/stripe-connect/tenantStripe'
import { isStripeTestAccount } from '@/lib/stripe-connect/test-accounts'
import { checkRole } from '@repo/shared-utils'
import type { User } from '@repo/shared-types'

type Id = string | number

type SourceApp = 'bru-grappling' | 'darkhorse-strength'

type Args = {
  dryRun: boolean
  from: SourceApp
  tenantId?: string
  tenantSlug?: string
  sourceDatabaseUri?: string
  limit?: number
  upsertByNaturalKey: boolean
  excludeChildData: boolean
  includePaymentMethods: boolean
  skipMedia: boolean
  skipUsers: boolean
  skipForms: boolean
  skipPages: boolean
  skipNavbarFooter: boolean
  skipBookingData: boolean
  /** When true (default), copy legacy salt:hash or source credential password into target accounts. */
  preservePasswords: boolean
}

function parseArgs(argv: string[]): Args {
  const out: Args = {
    dryRun: false,
    from: 'bru-grappling',
    upsertByNaturalKey: true,
    excludeChildData: false,
    includePaymentMethods: false,
    skipMedia: false,
    skipUsers: false,
    skipForms: false,
    skipPages: false,
    skipNavbarFooter: false,
    skipBookingData: false,
    preservePasswords: true,
  }

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dry-run') out.dryRun = true
    else if (a === '--from') {
      const v = argv[++i]
      if (v === 'bru-grappling' || v === 'darkhorse-strength') out.from = v
      else {
        console.error(`❌ Invalid --from "${v}". Use bru-grappling or darkhorse-strength.`)
        process.exit(1)
      }
    } else if (a === '--tenant-id') out.tenantId = argv[++i]
    else if (a === '--tenant-slug') out.tenantSlug = argv[++i]
    else if (a === '--source-database-uri') out.sourceDatabaseUri = argv[++i]
    else if (a === '--limit') out.limit = Number(argv[++i])
    else if (a === '--no-upsert') out.upsertByNaturalKey = false
    else if (a === '--exclude-child') out.excludeChildData = true
    else if (a === '--include-payment-methods') out.includePaymentMethods = true
    else if (a === '--skip-media') out.skipMedia = true
    else if (a === '--skip-users') out.skipUsers = true
    else if (a === '--skip-forms') out.skipForms = true
    else if (a === '--skip-pages') out.skipPages = true
    else if (a === '--skip-navbar-footer') out.skipNavbarFooter = true
    else if (a === '--skip-booking-data') out.skipBookingData = true
    else if (a === '--no-preserve-passwords') out.preservePasswords = false
  }

  return out
}

function blockInProduction(): void {
  const nodeEnv = process.env.NODE_ENV || 'development'
  if (nodeEnv === 'production') {
    console.error('❌ This migration script is disabled in production.')
    process.exit(1)
  }
}

async function getAdminReq(payload: Awaited<ReturnType<typeof getPayload>>) {
  const superAdmins = await payload.find({
    collection: 'users',
    where: { role: { contains: 'super-admin' } } as any,
    limit: 1,
    overrideAccess: true,
  } as any)
  let user = superAdmins.docs[0] ?? null
  if (!user) {
    const orgAdmins = await payload.find({
      collection: 'users',
      where: { role: { contains: 'admin' } } as any,
      limit: 1,
      overrideAccess: true,
    } as any)
    user = orgAdmins.docs[0] ?? null
  }
  if (!user || !checkRole(['super-admin', 'admin'], user as unknown as User)) {
    console.error(
      '❌ No super-admin or org admin user found (or roles misconfigured). Create a super-admin user first.',
    )
    process.exit(1)
  }

  return await createLocalReq({ user: { ...user, collection: 'users' } as any }, payload)
}

async function resolveTenantId(payload: Awaited<ReturnType<typeof getPayload>>, args: Args): Promise<string> {
  if (args.tenantId) return args.tenantId
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
    console.error(`❌ Tenant not found for slug "${args.tenantSlug}". Create it in atnd-me first.`)
    process.exit(1)
  }
  return String(tenant.id)
}

type IdMaps = {
  mediaIdMap: Map<Id, Id>
  formIdMap: Map<Id, Id>
  userIdMap: Map<Id, Id>
  instructorIdMap: Map<Id, Id>
  classOptionIdMap: Map<Id, Id>
  lessonIdMap: Map<Id, Id>
  planIdMap: Map<Id, Id>
  dropInIdMap: Map<Id, Id>
  subscriptionIdMap: Map<Id, Id>
  bookingIdMap: Map<Id, Id>
  transactionIdMap: Map<Id, Id>
  classPassTypeIdMap: Map<Id, Id>
  classPassIdMap: Map<Id, Id>
}

function mapBlockType(oldType: string, sourceApp: SourceApp): string {
  if (sourceApp === 'darkhorse-strength') {
    switch (oldType) {
      // Standalone darkhorse-strength app used unprefixed slugs; atnd-me uses dh* tenant blocks.
      case 'hero':
        return 'dhHero'
      case 'team':
        return 'dhTeam'
      case 'timetable':
        return 'dhTimetable'
      case 'testimonials':
        return 'dhTestimonials'
      case 'pricing':
        return 'dhPricing'
      case 'contact':
        return 'dhContact'
      case 'groups':
        return 'dhGroups'
      case 'reviews':
        return 'dhTestimonials'
      // Shared form block slug in legacy installs
      case 'form-block':
        return 'formBlock'
      case 'dhDashboardLayout':
        return 'twoColumnLayout'
      default:
        return oldType
    }
  }

  switch (oldType) {
    case 'hero':
      return 'bruHero'
    case 'about':
      return 'bruAbout'
    case 'schedule':
      return 'bruSchedule'
    case 'learning':
      return 'bruLearning'
    case 'meetTheTeam':
      return 'bruMeetTheTeam'
    case 'testimonials':
      return 'bruTestimonials'
    case 'reviews':
      // Bru had a simpler "reviews" block; migrate it into BruTestimonials shape.
      return 'bruTestimonials'
    case 'contact':
      return 'bruContact'
    case 'hero-waitlist':
      return 'bruHeroWaitlist'
    case 'dhDashboardLayout':
      return 'twoColumnLayout'
    default:
      return oldType
  }
}

const MEDIA_KEYS = new Set(['backgroundImage', 'logo', 'image'])
const FORM_KEYS = new Set(['form'])

function remapKnownRelationshipIds(value: unknown, maps: IdMaps): unknown {
  if (Array.isArray(value)) return value.map((v) => remapKnownRelationshipIds(v, maps))
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (MEDIA_KEYS.has(k) && (typeof v === 'string' || typeof v === 'number')) {
        out[k] = maps.mediaIdMap.get(v) ?? v
        continue
      }
      if (FORM_KEYS.has(k) && (typeof v === 'string' || typeof v === 'number')) {
        out[k] = maps.formIdMap.get(v) ?? v
        continue
      }
      out[k] = remapKnownRelationshipIds(v, maps)
    }
    return out
  }
  return value
}

function remapPageLayout(layout: unknown, maps: IdMaps, sourceApp: SourceApp): unknown {
  if (!Array.isArray(layout)) return layout
  return layout.map((block) => {
    if (!block || typeof block !== 'object') return block
    const b = block as Record<string, unknown>
    const blockType = typeof b.blockType === 'string' ? b.blockType : undefined
    const mapped = blockType ? mapBlockType(blockType, sourceApp) : blockType
    const withMappedType = blockType ? { ...b, blockType: mapped } : { ...b }
    return remapKnownRelationshipIds(withMappedType, maps)
  })
}

async function queryAll<T extends Record<string, unknown>>(
  pool: Pool,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await pool.query(sql, params)
  return res.rows as T[]
}

async function toRegClass(pool: Pool, name: string): Promise<string | null> {
  const res = await pool.query(`select to_regclass($1) as reg`, [name])
  const reg = res.rows?.[0]?.reg
  return typeof reg === 'string' ? reg : null
}

async function resolveTableName(pool: Pool, slugOrName: string): Promise<string | null> {
  const candidates = [
    slugOrName,
    slugOrName.replace(/-/g, '_'),
    `public.${slugOrName}`,
    `public.${slugOrName.replace(/-/g, '_')}`,
  ]
  for (const c of candidates) {
    const reg = await toRegClass(pool, c)
    if (reg) return reg
  }
  return null
}

/** First matching physical table (legacy single-tenant apps used different names). */
async function resolveFirstTableName(pool: Pool, slugOrNames: string[]): Promise<string | null> {
  for (const name of slugOrNames) {
    const resolved = await resolveTableName(pool, name)
    if (resolved) return resolved
  }
  return null
}

/**
 * Value to store in atnd-me `accounts.password` so users keep the same password as on the source app.
 * - Legacy Payload local auth: `users.salt` + `users.hash` → `salt:hash` (PBKDF2; verified by `@repo/auth-next`)
 * - Source already on Better Auth: copy existing credential row password (e.g. scrypt) unchanged.
 * Neither path uses `PAYLOAD_SECRET` or `BETTER_AUTH_SECRET`.
 */
async function getImportableCredentialPasswordFromSource(
  pool: Pool,
  row: Record<string, unknown>,
  sourceUserId: Id,
): Promise<string | null> {
  const salt = getRowValue<string>(row, 'salt')
  const hash = getRowValue<string>(row, 'hash')
  const saltS = salt != null && typeof salt === 'string' ? salt.trim() : ''
  const hashS = hash != null && typeof hash === 'string' ? hash.trim() : ''
  if (saltS.length > 0 && hashS.length > 0) {
    return `${saltS}:${hashS}`
  }

  const accountsTable = await resolveTableName(pool, 'accounts')
  if (!accountsTable) return null

  const res = await pool.query(
    `select "password" from ${accountsTable} where "user_id" = $1 and "provider_id" = $2 limit 1`,
    [sourceUserId, 'credential'],
  )
  const pw = res.rows?.[0]?.password
  if (typeof pw === 'string' && pw.trim().length > 0) return pw.trim()
  return null
}

/** Set `accounts.password` with raw SQL so Payload/Better Auth hooks do not re-hash the value. */
async function setTargetCredentialPassword(
  targetPool: Pool,
  targetUserId: number,
  passwordValue: string,
): Promise<void> {
  const upd = await targetPool.query(
    `update "accounts" set "password" = $1, "updated_at" = now() where "user_id" = $2 and "provider_id" = $3`,
    [passwordValue, targetUserId, 'credential'],
  )
  if ((upd.rowCount ?? 0) > 0) return

  await targetPool.query(
    `insert into "accounts" ("user_id", "account_id", "provider_id", "password", "updated_at", "created_at")
     values ($1, $2, 'credential', $3, now(), now())`,
    [targetUserId, String(targetUserId), passwordValue],
  )
}

function getRowValue<T = unknown>(row: Record<string, unknown>, camel: string): T | undefined {
  if (camel in row) return row[camel] as T
  const snake = camel.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)
  if (snake in row) return row[snake] as T
  return undefined
}

function getRowValueAny<T = unknown>(row: Record<string, unknown>, keys: string[]): T | undefined {
  for (const k of keys) {
    const v = getRowValue<T>(row, k)
    if (v !== undefined) return v
  }
  return undefined
}

function parseJSONIfString(value: unknown): unknown {
  if (typeof value !== 'string') return value
  const s = value.trim()
  if (!s) return value
  if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'))) {
    try {
      return JSON.parse(s)
    } catch {
      return value
    }
  }
  return value
}

function getObjValue<T = unknown>(obj: unknown, camel: string): T | undefined {
  if (!obj || typeof obj !== 'object') return undefined
  const o = obj as Record<string, unknown>
  if (camel in o) return o[camel] as T
  const snake = camel.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)
  if (snake in o) return o[snake] as T
  return undefined
}

/**
 * Standalone apps (bru-grappling, darkhorse-strength) used legacy role names.
 * atnd-me uses: platform `super-admin`, org/tenant manager `admin`, plus `staff` / `user`.
 */
function mapStandaloneRolesToAtndMe(roles: string[]): string[] {
  const out = new Set<string>()
  for (const r of roles) {
    switch (r) {
      case 'tenant-admin':
        out.add('admin')
        break
      case 'admin':
        out.add('super-admin')
        break
      case 'super-admin':
        out.add('super-admin')
        break
      case 'staff':
        out.add('staff')
        break
      case 'user':
        out.add('user')
        break
      default:
        out.add('user')
    }
  }
  if (out.size === 0) out.add('user')
  return Array.from(out)
}

function normalizeStringArray(value: unknown): string[] {
  if (value == null) return []

  if (Array.isArray(value)) return value.map((v) => String(v)).filter(Boolean)

  // JSON-encoded array or scalar
  const parsed = parseJSONIfString(value)
  if (parsed !== value) return normalizeStringArray(parsed)

  if (typeof value === 'string') {
    const s = value.trim()
    if (!s) return []

    // Postgres array literal: {a,b,"c d"}
    if (s.startsWith('{') && s.endsWith('}')) {
      const inner = s.slice(1, -1).trim()
      if (!inner) return []
      return inner
        .split(',')
        .map((part) => part.trim().replace(/^"(.*)"$/, '$1'))
        .filter(Boolean)
    }

    // Comma-separated fallback
    if (s.includes(',')) return s.split(',').map((p) => p.trim()).filter(Boolean)

    return [s]
  }

  return []
}

type LexicalState = {
  root: {
    type: string
    children: unknown[]
    direction: ('ltr' | 'rtl') | null
    format: string
    indent: number
    version: number
  }
  [k: string]: unknown
}

function isLexicalState(value: unknown): value is LexicalState {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  const root = v.root
  if (!root || typeof root !== 'object') return false
  const r = root as Record<string, unknown>
  return (
    typeof r.type === 'string' &&
    Array.isArray(r.children) &&
    (r.direction === null || r.direction === 'ltr' || r.direction === 'rtl') &&
    typeof r.format === 'string' &&
    typeof r.indent === 'number' &&
    typeof r.version === 'number'
  )
}

function lexicalFromPlainText(text: string): LexicalState {
  const t = String(text ?? '').trim()
  if (!t) return emptyLexical()
  return {
    root: {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          version: 1,
          children: [
            {
              type: 'text',
              version: 1,
              text: t,
              format: 0,
              detail: 0,
              mode: 'normal',
              style: '',
            },
          ],
          direction: 'ltr',
          format: '',
          indent: 0,
        },
      ],
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1,
    },
  }
}

function emptyLexical(): LexicalState {
  return {
    root: {
      type: 'root',
      children: [],
      direction: null,
      format: '',
      indent: 0,
      version: 1,
    },
  }
}

function normalizeLexical(value: unknown): LexicalState | null {
  if (value == null) return null
  if (isLexicalState(value)) return value
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed) as unknown
        if (isLexicalState(parsed)) return parsed
      } catch {
        // ignore
      }
    }
  }
  return null
}

function remapIdsDeep(value: unknown, map: Map<Id, Id>): unknown {
  if (Array.isArray(value)) return value.map((v) => remapIdsDeep(v, map))
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = remapIdsDeep(v, map)
    }
    return out
  }
  if (typeof value === 'string' || typeof value === 'number') return map.get(value) ?? value
  return value
}

function omitNil<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    // Important for Payload group/array fields: passing `null` can cause
    // server-side validation traversal to crash (it expects objects/arrays).
    // For this migration, we only set fields when we actually have a value.
    if (v === undefined || v === null) continue
    out[k] = v
  }
  return out as T
}

function getDefaultUserPassword(): { mode: 'fixed'; value: string } | { mode: 'random' } {
  const env = process.env.MIGRATION_DEFAULT_USER_PASSWORD
  if (env && env.trim().length > 0) return { mode: 'fixed', value: env.trim() }
  return { mode: 'random' }
}

async function migrateForms(
  pool: Pool,
  payload: Awaited<ReturnType<typeof getPayload>>,
  req: Awaited<ReturnType<typeof createLocalReq>>,
  tenantId: string,
  maps: IdMaps,
  args: Args,
): Promise<void> {
  const limit = args.limit ?? null
  const rows = await queryAll(
    pool,
    `select * from forms order by id asc${limit ? ' limit $1' : ''}`,
    limit ? [limit] : [],
  )

  console.log(`Forms: source rows=${rows.length}`)
  for (const row of rows) {
    const sourceId = row.id as Id

    const title = getRowValue<string>(row, 'title')
    const fields = getRowValue<unknown>(row, 'fields')
    const submitButtonLabel = getRowValue<string>(row, 'submitButtonLabel')
    const confirmationType = getRowValue<string>(row, 'confirmationType') ?? 'message'
    const redirect = getRowValue<{ url?: unknown }>(row, 'redirect')
    const emails = getRowValue<unknown>(row, 'emails')

    const rawConfirmationMessage = getRowValue<unknown>(row, 'confirmationMessage')
    let confirmationMessage = normalizeLexical(rawConfirmationMessage)

    // Some installs require a confirmationMessage when confirmationType=message.
    if ((confirmationType === 'message' || confirmationType == null) && !confirmationMessage) {
      confirmationMessage = emptyLexical()
    }

    // If redirect type is selected but no valid URL, fall back to message.
    const redirectUrl = redirect && typeof redirect === 'object' ? (redirect as any).url : undefined
    const hasRedirectUrl = typeof redirectUrl === 'string' && redirectUrl.trim().length > 0
    const finalConfirmationType =
      confirmationType === 'redirect' && hasRedirectUrl ? 'redirect' : 'message'

    const data: Record<string, unknown> = {
      tenant: Number(tenantId),
      title: title ?? `Migrated form ${String(sourceId)}`,
      fields: fields ?? null,
      submitButtonLabel: submitButtonLabel ?? null,
      confirmationType: finalConfirmationType,
      confirmationMessage,
      ...(finalConfirmationType === 'redirect' ? { redirect: { url: String(redirectUrl) } } : {}),
      ...(emails != null ? { emails } : {}),
    }

    if (args.dryRun) {
      maps.formIdMap.set(sourceId, sourceId)
      continue
    }

    try {
      const created = await payload.create({
        collection: 'forms',
        data,
        req,
        overrideAccess: true,
        // Script context: allow schema differences between source/target.
      } as any)
      maps.formIdMap.set(sourceId, created.id as Id)
    } catch (err) {
      console.error(`❌ Failed to migrate form id=${String(sourceId)} title=${String(data.title)}`)
      throw err
    }
  }
}

async function findExistingIdByField(
  payload: Awaited<ReturnType<typeof getPayload>>,
  collection: string,
  field: string,
  value: string,
): Promise<Id | null> {
  const res = await payload.find({
    collection: collection as any,
    where: { [field]: { equals: value } } as any,
    limit: 1,
    depth: 0,
    overrideAccess: true,
  } as any)
  const doc = res?.docs?.[0]
  return doc?.id ?? null
}

async function migrateUsers(
  pool: Pool,
  targetPool: Pool,
  payload: Awaited<ReturnType<typeof getPayload>>,
  req: Awaited<ReturnType<typeof createLocalReq>>,
  tenantId: string,
  maps: IdMaps,
  args: Args,
): Promise<void> {
  const table = await resolveTableName(pool, 'users')
  if (!table) {
    console.warn('Users: source table not found, skipping')
    return
  }
  const limit = args.limit ?? null
  const rows = await queryAll(pool, `select * from ${table} order by id asc${limit ? ' limit $1' : ''}`, limit ? [limit] : [])

  console.log(`Users: source rows=${rows.length}`)
  const passwordMode = getDefaultUserPassword()
  if (args.preservePasswords) {
    console.log(
      'Users: preservePasswords=yes — copying salt:hash or source credential password into target accounts (secrets need not match).',
    )
  } else if (passwordMode.mode === 'fixed') {
    console.warn(
      'Users: using MIGRATION_DEFAULT_USER_PASSWORD for all newly created users (existing users are not modified).',
    )
  } else {
    console.warn(
      'Users: creating new users with a random password (not printed). Users will need to use password reset to sign in.',
    )
  }

  for (const row of rows) {
    const sourceId = row.id as Id
    const email = getRowValue<string>(row, 'email')?.toLowerCase()
    const name = getRowValue<string>(row, 'name') ?? (email ? email.split('@')[0] : `User ${String(sourceId)}`)
    const emailVerified = Boolean(getRowValue(row, 'emailVerified') ?? false)

    if (!email) {
      console.warn(`Users: skipping id=${String(sourceId)} (missing email)`)
      continue
    }

    // Optional: skip child accounts (bru-grappling had child flows; atnd-me migration often excludes these)
    if (args.excludeChildData) {
      const parentUser = getRowValueAny(row, ['parentUser', 'parent_user', 'parentUserId', 'parent_user_id'])
      if (parentUser != null) continue
    }

    if (args.upsertByNaturalKey) {
      const existingId = await findExistingIdByField(payload, 'users', 'email', email)
      if (existingId != null) {
        maps.userIdMap.set(sourceId, existingId)
        continue
      }
    }

    const rolesRaw = getRowValueAny(row, ['roles', 'role'])
    const roles = normalizeStringArray(rolesRaw)
    const safeRoles = mapStandaloneRolesToAtndMe(roles)

    const importedCredential =
      args.preservePasswords && !args.dryRun
        ? await getImportableCredentialPasswordFromSource(pool, row, sourceId)
        : null

    const passwordForCreate =
      importedCredential != null
        ? randomBytes(24).toString('base64url')
        : passwordMode.mode === 'fixed'
          ? passwordMode.value
          : randomBytes(24).toString('base64url')

    const data = omitNil({
      email,
      name,
      emailVerified,
      role: safeRoles.length > 0 ? safeRoles : ['user'],
      registrationTenant: Number(tenantId),
      tenants: [{ tenant: Number(tenantId) }],
      stripeCustomerId: getRowValue<string>(row, 'stripeCustomerId'),
      banned: getRowValue<boolean>(row, 'banned'),
      banReason: getRowValue<string>(row, 'banReason'),
      banExpires: getRowValue<string>(row, 'banExpires'),
      password: passwordForCreate,
    })

    if (args.dryRun) {
      maps.userIdMap.set(sourceId, sourceId)
      continue
    }

    const created = await payload.create({
      collection: 'users',
      data,
      req,
      overrideAccess: true,
    } as any)
    const newUserId = Number(created.id)
    maps.userIdMap.set(sourceId, created.id as Id)

    if (args.preservePasswords && importedCredential != null) {
      await setTargetCredentialPassword(targetPool, newUserId, importedCredential)
    }
  }
}

async function migratePlans(
  pool: Pool,
  payload: Awaited<ReturnType<typeof getPayload>>,
  req: Awaited<ReturnType<typeof createLocalReq>>,
  tenantId: string,
  maps: IdMaps,
  args: Args,
): Promise<void> {
  const table = await resolveTableName(pool, 'plans')
  if (!table) {
    console.warn('Plans: source table not found, skipping')
    return
  }
  // For bru-grappling → atnd-me, membership Stripe products live on the tenant's Connect account.
  // The shared plans hook syncs via the platform Stripe client (no stripeAccount), so it can't
  // populate prices for Connect-owned products. We hydrate price info here instead.
  const tenant = await payload.findByID({
    collection: 'tenants',
    id: Number(tenantId),
    depth: 0,
    overrideAccess: true,
  } as any)
  const tenantStripe = tenant as unknown as TenantStripeLike
  const tenantStripeCtx = getTenantStripeContext(tenantStripe)
  const tenantStripeAccountId =
    tenantStripeCtx.isConnected && tenantStripeCtx.accountId && !isStripeTestAccount(tenantStripeCtx.accountId)
      ? tenantStripeCtx.accountId
      : null
  const stripe = tenantStripeAccountId ? getPlatformStripe() : null
  const productCache = new Map<string, { priceInformation?: unknown; priceJSON?: string }>()

  const limit = args.limit ?? null
  const rows = await queryAll(pool, `select * from ${table} order by id asc${limit ? ' limit $1' : ''}`, limit ? [limit] : [])
  console.log(`Plans: source rows=${rows.length}`)
  for (const row of rows) {
    const sourceId = row.id as Id
    const name = getRowValue<string>(row, 'name') ?? `Plan ${String(sourceId)}`

    const stripeProductId = getRowValue(row, 'stripeProductId') as string | undefined

    // Hydrate missing price info from Stripe Connect if possible.
    const hydrateFromConnectIfNeeded = async (incoming: {
      priceInformation?: unknown
      priceJSON?: string | null | undefined
      status?: unknown
    }): Promise<{ priceInformation?: unknown; priceJSON?: string }> => {
      const hasPrice =
        incoming.priceInformation &&
        typeof incoming.priceInformation === 'object' &&
        incoming.priceInformation !== null &&
        'price' in (incoming.priceInformation as Record<string, unknown>) &&
        (incoming.priceInformation as Record<string, unknown>).price != null

      if (hasPrice) return { priceInformation: incoming.priceInformation, priceJSON: incoming.priceJSON ?? undefined }
      if (!stripe || !tenantStripeAccountId || !stripeProductId) return { priceInformation: incoming.priceInformation, priceJSON: incoming.priceJSON ?? undefined }

      const cached = productCache.get(stripeProductId)
      if (cached) return cached

      try {
        const product = await stripe.products.retrieve(
          stripeProductId,
          { expand: ['default_price'] },
          { stripeAccount: tenantStripeAccountId },
        )
        const defaultPrice =
          typeof product.default_price === 'object' && product.default_price != null
            ? (product.default_price as any)
            : typeof product.default_price === 'string'
              ? await stripe.prices.retrieve(product.default_price, undefined, { stripeAccount: tenantStripeAccountId })
              : null

        const unitAmount = typeof defaultPrice?.unit_amount === 'number' ? defaultPrice.unit_amount : null
        const price = unitAmount != null ? unitAmount / 100 : undefined
        const interval = defaultPrice?.recurring?.interval as unknown
        const intervalCount = defaultPrice?.recurring?.interval_count as unknown

        const hydrated = {
          ...(price != null ? { priceInformation: omitNil({ price, interval, intervalCount } as any) } : {}),
          priceJSON: JSON.stringify({ id: defaultPrice?.id ?? null }),
        }
        productCache.set(stripeProductId, hydrated)
        return hydrated
      } catch (e) {
        console.warn(`Plans: failed to hydrate price from Stripe for "${name}" (stripeProductId=${stripeProductId}):`, e)
        const fallback = { priceInformation: incoming.priceInformation, priceJSON: incoming.priceJSON ?? undefined }
        productCache.set(stripeProductId, fallback)
        return fallback
      }
    }

    if (args.upsertByNaturalKey) {
      const existingId = await findExistingIdByField(payload, 'plans', 'name', name)
      if (existingId != null) {
        // If the existing membership is missing a price, fill it (idempotent repair).
        if (!args.dryRun) {
          const existing = await payload.findByID({
            collection: 'plans',
            id: existingId,
            depth: 0,
            overrideAccess: true,
          } as any).catch(() => null)
          const existingPrice = (existing as any)?.priceInformation?.price
          const shouldRepairPrice =
            existingPrice == null &&
            stripeProductId != null &&
            tenantStripeAccountId != null

          if (shouldRepairPrice) {
            const hydrated = await hydrateFromConnectIfNeeded({
              priceInformation: undefined,
              priceJSON: undefined,
            })
            if (hydrated.priceInformation || hydrated.priceJSON) {
              await payload.update({
                collection: 'plans',
                id: existingId,
                data: {
                  ...(hydrated.priceInformation ? { priceInformation: hydrated.priceInformation } : {}),
                  ...(hydrated.priceJSON ? { priceJSON: hydrated.priceJSON } : {}),
                  skipSync: true,
                } as any,
                context: { ...(req as any).context, skipStripeSync: true },
                req,
                overrideAccess: true,
              } as any)
            }
          }
        }

        maps.planIdMap.set(sourceId, existingId)
        continue
      }
    }

    const sourceFeatures = parseJSONIfString(getRowValue(row, 'features'))
    const sourceSessionsInfo = parseJSONIfString(getRowValue(row, 'sessionsInformation'))
    const sourcePriceInfo = parseJSONIfString(getRowValue(row, 'priceInformation'))
    const sourcePriceJSON = getRowValue(row, 'priceJSON') as string | undefined

    const hydrated = await hydrateFromConnectIfNeeded({
      priceInformation: sourcePriceInfo,
      priceJSON: sourcePriceJSON,
    })

    const data = omitNil({
      tenant: Number(tenantId),
      name,
      features: sourceFeatures ?? null,
      sessionsInformation: sourceSessionsInfo ?? null,
      stripeProductId,
      ...(hydrated.priceInformation ? { priceInformation: hydrated.priceInformation } : {}),
      ...(hydrated.priceJSON ? { priceJSON: hydrated.priceJSON } : {}),
      status: getRowValue(row, 'status') ?? 'active',
      skipSync: true,
      type: getRowValue(row, 'type') ?? null,
      quantity: getRowValue(row, 'quantity') ?? null,
    })

    if (args.dryRun) {
      maps.planIdMap.set(sourceId, sourceId)
      continue
    }

    const created = await payload.create({
      collection: 'plans',
      data,
      req,
      overrideAccess: true,
    } as any)
    maps.planIdMap.set(sourceId, created.id as Id)
  }
}

async function migrateDropIns(
  pool: Pool,
  payload: Awaited<ReturnType<typeof getPayload>>,
  req: Awaited<ReturnType<typeof createLocalReq>>,
  tenantId: string,
  maps: IdMaps,
  args: Args,
): Promise<void> {
  const table = await resolveTableName(pool, 'drop-ins')
  if (!table) {
    console.warn('DropIns: source table not found, skipping')
    return
  }
  const limit = args.limit ?? null
  const rows = await queryAll(pool, `select * from ${table} order by id asc${limit ? ' limit $1' : ''}`, limit ? [limit] : [])
  console.log(`DropIns: source rows=${rows.length}`)
  for (const row of rows) {
    const sourceId = row.id as Id
    const name = getRowValue<string>(row, 'name') ?? `DropIn ${String(sourceId)}`

    if (args.upsertByNaturalKey) {
      const existingId = await findExistingIdByField(payload, 'drop-ins', 'name', name)
      if (existingId != null) {
        maps.dropInIdMap.set(sourceId, existingId)
        continue
      }
    }

    const data = omitNil({
      tenant: Number(tenantId),
      name,
      description: getRowValue(row, 'description') ?? null,
      isActive: Boolean(getRowValue(row, 'isActive') ?? true),
      price: Number(getRowValue(row, 'price') ?? 0),
      adjustable: Boolean(getRowValue(row, 'adjustable') ?? false),
      discountTiers: parseJSONIfString(getRowValue(row, 'discountTiers')) ?? null,
      paymentMethods: parseJSONIfString(getRowValue(row, 'paymentMethods')) ?? ['card'],
    })

    if (args.dryRun) {
      maps.dropInIdMap.set(sourceId, sourceId)
      continue
    }

    const created = await payload.create({
      collection: 'drop-ins',
      data,
      req,
      overrideAccess: true,
    } as any)
    maps.dropInIdMap.set(sourceId, created.id as Id)
  }
}

async function migrateEventTypes(
  pool: Pool,
  payload: Awaited<ReturnType<typeof getPayload>>,
  req: Awaited<ReturnType<typeof createLocalReq>>,
  tenantId: string,
  maps: IdMaps,
  args: Args,
): Promise<void> {
  const table = await resolveFirstTableName(pool, [
    'event-types',
    'event_types',
    'class-options',
    'class_options',
  ])
  if (!table) {
    console.warn('EventTypes: source table not found (tried event-types, class_options), skipping')
    return
  }
  const limit = args.limit ?? null
  const rows = await queryAll(pool, `select * from ${table} order by id asc${limit ? ' limit $1' : ''}`, limit ? [limit] : [])
  console.log(`EventTypes: source table=${table}, rows=${rows.length}`)

  // If tenant isn't Stripe-connected, enabling payments will fail. Default to off unless explicitly requested.
  const tenant = await payload.findByID({
    collection: 'tenants',
    id: Number(tenantId),
    depth: 0,
    overrideAccess: true,
  } as any)
  const stripeStatus = (tenant as any)?.stripeConnectOnboardingStatus as string | undefined
  const canEnablePayments = stripeStatus === 'active'

  for (const row of rows) {
    const sourceId = row.id as Id
    const name = getRowValue<string>(row, 'name') ?? `Class Option ${String(sourceId)}`
    const type = (getRowValue<string>(row, 'type') ?? 'adult') as 'adult' | 'child' | 'family'

    if (args.excludeChildData && (type === 'child' || type === 'family')) continue

    if (args.upsertByNaturalKey) {
      // Name isn't globally unique; best effort within tenant.
      const res = await payload.find({
        collection: 'event-types',
        where: { and: [{ tenant: { equals: Number(tenantId) } }, { name: { equals: name } }] } as any,
        limit: 1,
        depth: 0,
        overrideAccess: true,
      } as any)
      const existingId = res?.docs?.[0]?.id ?? null
      if (existingId != null) {
        maps.classOptionIdMap.set(sourceId, existingId)
        continue
      }
    }

    const sourcePm = parseJSONIfString(getRowValue<Record<string, unknown>>(row, 'paymentMethods'))
    const mappedPaymentMethods =
      args.includePaymentMethods && canEnablePayments && sourcePm
        ? {
            allowedDropIn: (() => {
              const allowedDropIn = getObjValue(sourcePm, 'allowedDropIn')
              if (allowedDropIn == null) return null
              return (maps.dropInIdMap.get(allowedDropIn as any) ?? allowedDropIn) as any
            })(),
            allowedPlans: (() => {
              const allowedPlans = getObjValue(sourcePm, 'allowedPlans')
              const arr = Array.isArray(allowedPlans) ? allowedPlans : []
              return (arr.map((id) => maps.planIdMap.get(id as any) ?? id) as any) as any
            })(),
          }
        : undefined

    const data = omitNil({
      tenant: Number(tenantId),
      name,
      places: Number(getRowValue(row, 'places') ?? 0),
      description: getRowValue<string>(row, 'description') ?? '',
      type,
      ...(mappedPaymentMethods ? { paymentMethods: mappedPaymentMethods } : {}),
    })

    if (args.includePaymentMethods && !canEnablePayments) {
      console.warn(
        `EventTypes: omitting paymentMethods for "${name}" because tenant stripeConnectOnboardingStatus=${String(
          stripeStatus ?? 'unset',
        )}`,
      )
    }

    if (args.dryRun) {
      maps.classOptionIdMap.set(sourceId, sourceId)
      continue
    }

    const created = await payload.create({
      collection: 'event-types',
      data,
      req,
      overrideAccess: true,
    } as any)
    maps.classOptionIdMap.set(sourceId, created.id as Id)
  }
}

async function migrateStaffMembers(
  pool: Pool,
  payload: Awaited<ReturnType<typeof getPayload>>,
  req: Awaited<ReturnType<typeof createLocalReq>>,
  tenantId: string,
  maps: IdMaps,
  args: Args,
): Promise<void> {
  const table = await resolveFirstTableName(pool, [
    'staff_members',
    'staff-members',
    'staffMembers',
    'instructors',
  ])
  if (!table) {
    console.warn('StaffMembers: source table not found (tried staff_members, instructors), skipping')
    return
  }
  const limit = args.limit ?? null
  const rows = await queryAll(pool, `select * from ${table} order by id asc${limit ? ' limit $1' : ''}`, limit ? [limit] : [])
  console.log(`StaffMembers: source table=${table}, rows=${rows.length}`)
  for (const row of rows) {
    const sourceId = row.id as Id
    const userId = getRowValueAny<Id>(row, ['user', 'userId', 'user_id'])
    const mappedUserId = userId != null ? maps.userIdMap.get(userId) : null
    if (mappedUserId == null) {
      console.warn(`StaffMembers: skipping id=${String(sourceId)} (user not mapped)`)
      continue
    }

    const data = omitNil({
      tenant: Number(tenantId),
      user: mappedUserId,
      name: getRowValue(row, 'name') ?? null,
      description: getRowValue(row, 'description') ?? null,
      profileImage: null, // media migration not implemented
      active: getRowValue(row, 'active') ?? true,
    })

    if (args.dryRun) {
      maps.instructorIdMap.set(sourceId, sourceId)
      continue
    }

    const created = await payload.create({
      collection: 'staffMembers',
      data,
      req,
      overrideAccess: true,
    } as any)
    maps.instructorIdMap.set(sourceId, created.id as Id)
  }
}

async function migrateTimeslots(
  pool: Pool,
  payload: Awaited<ReturnType<typeof getPayload>>,
  req: Awaited<ReturnType<typeof createLocalReq>>,
  tenantId: string,
  maps: IdMaps,
  args: Args,
): Promise<void> {
  const table = await resolveFirstTableName(pool, ['timeslots', 'lessons'])
  if (!table) {
    console.warn('Timeslots: source table not found (tried timeslots, lessons), skipping')
    return
  }
  const limit = args.limit ?? null
  const rows = await queryAll(pool, `select * from ${table} order by id asc${limit ? ' limit $1' : ''}`, limit ? [limit] : [])
  console.log(`Timeslots: source table=${table}, rows=${rows.length}`)
  for (const row of rows) {
    const sourceId = row.id as Id
    const sourceEventType = getRowValueAny<Id>(row, [
      'eventType',
      'event_type',
      'eventTypeId',
      'event_type_id',
      'classOption',
      'class_option',
      'classOptionId',
      'class_option_id',
    ])
    const mappedEventType = sourceEventType != null ? maps.classOptionIdMap.get(sourceEventType) : null
    if (mappedEventType == null) {
      console.warn(
        `Timeslots: skipping id=${String(sourceId)} (event-type/class-option id=${String(sourceEventType)} not in map)`,
      )
      continue
    }
    const sourceStaffMember = getRowValueAny<Id>(row, [
      'instructor',
      'instructorId',
      'instructor_id',
      'staffMember',
      'staff_member',
      'staffMemberId',
      'staff_member_id',
    ])
    const mappedStaffMember = sourceStaffMember != null ? maps.instructorIdMap.get(sourceStaffMember) : null

    const data = omitNil({
      tenant: Number(tenantId),
      date: getRowValue(row, 'date'),
      startTime: getRowValue(row, 'startTime'),
      endTime: getRowValue(row, 'endTime'),
      lockOutTime: Number(getRowValue(row, 'lockOutTime') ?? getRowValue(row, 'lock_out_time') ?? 0),
      originalLockOutTime: getRowValue(row, 'originalLockOutTime') ?? null,
      location: getRowValue(row, 'location') ?? null,
      staffMember: mappedStaffMember ?? null,
      eventType: mappedEventType,
      remainingCapacity: getRowValue(row, 'remainingCapacity') ?? null,
      bookingStatus: getRowValue(row, 'bookingStatus') ?? null,
      active: getRowValue(row, 'active') ?? true,
    })

    if (args.dryRun) {
      maps.lessonIdMap.set(sourceId, sourceId)
      continue
    }

    const created = await payload.create({
      collection: 'timeslots',
      data,
      req,
      overrideAccess: true,
    } as any)
    maps.lessonIdMap.set(sourceId, created.id as Id)
  }
}

async function migrateSubscriptions(
  pool: Pool,
  payload: Awaited<ReturnType<typeof getPayload>>,
  req: Awaited<ReturnType<typeof createLocalReq>>,
  tenantId: string,
  maps: IdMaps,
  args: Args,
): Promise<void> {
  const table = await resolveTableName(pool, 'subscriptions')
  if (!table) {
    console.warn('Subscriptions: source table not found, skipping')
    return
  }
  const limit = args.limit ?? null
  const rows = await queryAll(pool, `select * from ${table} order by id asc${limit ? ' limit $1' : ''}`, limit ? [limit] : [])
  console.log(`Subscriptions: source rows=${rows.length}`)
  for (const row of rows) {
    const sourceId = row.id as Id
    const sourceUser = getRowValueAny<Id>(row, ['user', 'userId', 'user_id'])
    const sourcePlan = getRowValueAny<Id>(row, ['plan', 'planId', 'plan_id'])
    const mappedUser = sourceUser != null ? maps.userIdMap.get(sourceUser) : null
    const mappedPlan = sourcePlan != null ? maps.planIdMap.get(sourcePlan) : null
    if (mappedUser == null || mappedPlan == null) {
      console.warn(`Subscriptions: skipping id=${String(sourceId)} (user/plan not mapped)`)
      continue
    }

    const data = omitNil({
      tenant: Number(tenantId),
      user: mappedUser,
      plan: mappedPlan,
      status: getRowValue(row, 'status') ?? 'active',
      startDate: getRowValue(row, 'startDate') ?? null,
      endDate: getRowValue(row, 'endDate') ?? null,
      cancelAt: getRowValue(row, 'cancelAt') ?? null,
      stripeSubscriptionId: getRowValue(row, 'stripeSubscriptionId') ?? null,
      skipSync: true,
    })

    if (args.dryRun) {
      maps.subscriptionIdMap.set(sourceId, sourceId)
      continue
    }

    const created = await payload.create({
      collection: 'subscriptions',
      data,
      req,
      overrideAccess: true,
    } as any)
    maps.subscriptionIdMap.set(sourceId, created.id as Id)
  }
}

async function migrateBookings(
  pool: Pool,
  payload: Awaited<ReturnType<typeof getPayload>>,
  req: Awaited<ReturnType<typeof createLocalReq>>,
  tenantId: string,
  maps: IdMaps,
  args: Args,
): Promise<void> {
  const table = await resolveTableName(pool, 'bookings')
  if (!table) {
    console.warn('Bookings: source table not found, skipping')
    return
  }
  const limit = args.limit ?? null
  const rows = await queryAll(pool, `select * from ${table} order by id asc${limit ? ' limit $1' : ''}`, limit ? [limit] : [])
  console.log(`Bookings: source rows=${rows.length}`)
  for (const row of rows) {
    const sourceId = row.id as Id
    const sourceUser = getRowValueAny<Id>(row, ['user', 'userId', 'user_id'])
    const sourceTimeslot = getRowValueAny<Id>(row, [
      'timeslot',
      'timeslotId',
      'timeslot_id',
      'lesson',
      'lessonId',
      'lesson_id',
    ])
    const mappedUser = sourceUser != null ? maps.userIdMap.get(sourceUser) : null
    const mappedTimeslot = sourceTimeslot != null ? maps.lessonIdMap.get(sourceTimeslot) : null
    if (mappedUser == null || mappedTimeslot == null) {
      const parts: string[] = []
      if (mappedUser == null) parts.push(`user id=${String(sourceUser)} not in map`)
      if (mappedTimeslot == null) parts.push(`timeslot/lesson id=${String(sourceTimeslot)} not in map`)
      console.warn(`Bookings: skipping id=${String(sourceId)} (${parts.join('; ')})`)
      continue
    }

    const data = omitNil({
      tenant: Number(tenantId),
      user: mappedUser,
      timeslot: mappedTimeslot,
      status: getRowValue(row, 'status') ?? 'confirmed',
    })

    if (args.dryRun) {
      maps.bookingIdMap.set(sourceId, sourceId)
      continue
    }

    const created = await payload.create({
      collection: 'bookings',
      data,
      req,
      overrideAccess: true,
    } as any)
    maps.bookingIdMap.set(sourceId, created.id as Id)
  }
}

async function migrateTransactions(
  pool: Pool,
  payload: Awaited<ReturnType<typeof getPayload>>,
  req: Awaited<ReturnType<typeof createLocalReq>>,
  tenantId: string,
  maps: IdMaps,
  args: Args,
): Promise<void> {
  const table = await resolveTableName(pool, 'transactions')
  if (!table) {
    console.warn('Transactions: source table not found, skipping')
    return
  }
  const limit = args.limit ?? null
  const rows = await queryAll(pool, `select * from ${table} order by id asc${limit ? ' limit $1' : ''}`, limit ? [limit] : [])
  console.log(`Transactions: source rows=${rows.length}`)
  for (const row of rows) {
    const sourceId = row.id as Id
    const sourceBooking = getRowValueAny<Id>(row, ['booking', 'bookingId', 'booking_id'])
    const mappedBooking = sourceBooking != null ? maps.bookingIdMap.get(sourceBooking) : null
    if (mappedBooking == null) {
      console.warn(`Transactions: skipping id=${String(sourceId)} (booking not mapped)`)
      continue
    }

    const paymentMethod = getRowValue<string>(row, 'paymentMethod') ?? 'stripe'
    const subscriptionId = getRowValueAny<Id>(row, ['subscriptionId', 'subscription_id'])
    const mappedSubscription = subscriptionId != null ? maps.subscriptionIdMap.get(subscriptionId) : null

    const data = omitNil({
      tenant: Number(tenantId),
      booking: mappedBooking,
      paymentMethod,
      classPassId: null,
      stripePaymentIntentId: getRowValue(row, 'stripePaymentIntentId') ?? null,
      subscriptionId: mappedSubscription ?? null,
    })

    if (args.dryRun) {
      maps.transactionIdMap.set(sourceId, sourceId)
      continue
    }

    const created = await payload.create({
      collection: 'transactions',
      data,
      req,
      overrideAccess: true,
    } as any)
    maps.transactionIdMap.set(sourceId, created.id as Id)
  }
}

async function migratePages(
  pool: Pool,
  payload: Awaited<ReturnType<typeof getPayload>>,
  req: Awaited<ReturnType<typeof createLocalReq>>,
  tenantId: string,
  maps: IdMaps,
  args: Args,
): Promise<void> {
  const table = await resolveTableName(pool, 'pages')
  if (!table) {
    console.warn('Pages: source table not found, skipping')
    return
  }
  const limit = args.limit ?? null
  const rows = await queryAll(
    pool,
    `select * from ${table} order by id asc${limit ? ' limit $1' : ''}`,
    limit ? [limit] : [],
  )

  console.log(`Pages: source rows=${rows.length}`)

  const tenantNum = Number(tenantId)
  const tenantReq = { ...req, context: { ...(req as any).context, tenant: tenantNum } }

  const knownBlockSlugs = new Set<string>([...allBlockSlugs, 'threeColumnLayout', 'twoColumnLayout'])

  const remapLayout = (layoutUnknown: unknown): unknown[] => {
    const raw = parseJSONIfString(layoutUnknown)
    const arr = Array.isArray(raw) ? raw : []
    const out: unknown[] = []
    for (const blk of arr) {
      if (!blk || typeof blk !== 'object') continue
      const b = blk as Record<string, unknown>
      const oldType = typeof b.blockType === 'string' ? b.blockType : null
      if (!oldType) continue

      const mappedType = mapBlockType(oldType, args.from)
      if (!knownBlockSlugs.has(mappedType)) {
        console.warn(`Pages: dropping unknown blockType "${mappedType}" (from "${oldType}")`)
        continue
      }

      // Special-case: reviews -> bruTestimonials / dhTestimonials shape transform
      let mappedBlock: Record<string, unknown> = { ...b, blockType: mappedType }
      if (
        oldType === 'reviews' &&
        (mappedType === 'bruTestimonials' || mappedType === 'dhTestimonials')
      ) {
        const reviews = parseJSONIfString(b.reviews)
        const reviewArr = Array.isArray(reviews) ? reviews : []
        mappedBlock = {
          ...mappedBlock,
          testimonials: reviewArr.map((r) => {
            if (!r || typeof r !== 'object') return null
            const rr = r as Record<string, unknown>
            return {
              image: rr.image,
              name: rr.author ?? 'Anonymous',
              role: rr.role ?? '',
              testimonial: lexicalFromPlainText(String(rr.content ?? '')),
            }
          }).filter(Boolean),
        }
        delete mappedBlock.reviews
      }

      out.push(remapKnownRelationshipIds(mappedBlock, maps))
    }
    return out
  }

  // Ensure tenant allowedBlocks includes all extra blocks used in migrated pages (otherwise Payload rejects layout).
  const used = new Set<string>()
  for (const row of rows) {
    const mappedLayout = remapLayout((row as any).layout)
    for (const blk of mappedLayout) {
      if (!blk || typeof blk !== 'object') continue
      const t = (blk as any).blockType
      if (typeof t === 'string') used.add(t)
    }
  }
  const neededExtra = Array.from(used).filter(
    (s) => !defaultBlockSlugs.includes(s) && extraBlockSlugs.includes(s),
  )
  if (neededExtra.length > 0 && !args.dryRun) {
    const tenantDoc = await payload.findByID({
      collection: 'tenants',
      id: tenantNum,
      depth: 0,
      overrideAccess: true,
    } as any)
    const existing = Array.isArray((tenantDoc as any)?.allowedBlocks) ? (tenantDoc as any).allowedBlocks : []
    const merged = Array.from(new Set<string>([...existing, ...neededExtra]))
    await payload.update({
      collection: 'tenants',
      id: tenantNum,
      data: { allowedBlocks: merged },
      req,
      overrideAccess: true,
    } as any)
  }

  for (const row of rows) {
    const title = String(getRowValue(row, 'title') ?? '').trim() || 'Untitled'
    const slug = String(getRowValue(row, 'slug') ?? '').trim() || title.toLowerCase().replace(/\s+/g, '-')

    const mappedLayout = remapLayout((row as any).layout)
    if (mappedLayout.length === 0) {
      console.warn(`Pages: skipping "${slug}" (empty/invalid layout after mapping)`)
      continue
    }

    const data = omitNil({
      title,
      slug,
      tenant: tenantNum,
      layout: mappedLayout,
      publishedAt: getRowValue(row, 'publishedAt') ?? null,
      meta: parseJSONIfString(getRowValue(row, 'meta')) ?? undefined,
    })

    if (args.dryRun) continue

    if (args.upsertByNaturalKey) {
      const existing = await payload.find({
        collection: 'pages',
        where: { and: [{ tenant: { equals: tenantNum } }, { slug: { equals: slug } }] } as any,
        limit: 1,
        depth: 0,
        req: tenantReq as any,
        overrideAccess: true,
      } as any)
      const existingDoc = existing?.docs?.[0]
      if (existingDoc?.id) {
        await payload.update({
          collection: 'pages',
          id: existingDoc.id,
          data,
          req: tenantReq as any,
          context: { disableRevalidate: true },
          overrideAccess: true,
        } as any)
        continue
      }
    }

    await payload.create({
      collection: 'pages',
      data,
      req: tenantReq as any,
      context: { disableRevalidate: true },
      overrideAccess: true,
    } as any)
  }
}

async function main() {
  blockInProduction()

  const args = parseArgs(process.argv.slice(2))
  const sourceDatabaseUri =
    args.sourceDatabaseUri ||
    (args.from === 'darkhorse-strength'
      ? process.env.DH_SOURCE_DATABASE_URI || process.env.DARKHORSE_SOURCE_DATABASE_URI
      : process.env.BRU_SOURCE_DATABASE_URI) ||
    process.env.SOURCE_DATABASE_URI

  if (!process.env.DATABASE_URI) {
    console.error('❌ DATABASE_URI must be set for atnd-me target DB')
    process.exit(1)
  }
  if (!sourceDatabaseUri) {
    const hint =
      args.from === 'darkhorse-strength'
        ? 'DH_SOURCE_DATABASE_URI, DARKHORSE_SOURCE_DATABASE_URI, SOURCE_DATABASE_URI, or --source-database-uri'
        : 'BRU_SOURCE_DATABASE_URI, SOURCE_DATABASE_URI, or --source-database-uri'
    console.error(`❌ Missing source DB connection string. Provide ${hint}`)
    process.exit(1)
  }

  const payload = await getPayload()
  const req = await getAdminReq(payload)
  const tenantId = await resolveTenantId(payload, args)

  console.log(`Target tenant id: ${tenantId}`)
  console.log(`Source app: ${args.from}`)
  console.log(`Dry run: ${args.dryRun ? 'yes' : 'no'}`)
  console.log(`Upsert: ${args.upsertByNaturalKey ? 'yes' : 'no'}`)
  console.log(`Exclude child data: ${args.excludeChildData ? 'yes' : 'no'}`)
  console.log(`Include payment methods: ${args.includePaymentMethods ? 'yes' : 'no'}`)
  console.log(`Preserve passwords: ${args.preservePasswords ? 'yes' : 'no'}`)

  const sourcePool = new Pool({ connectionString: sourceDatabaseUri })
  const targetPool = new Pool({ connectionString: process.env.DATABASE_URI })
  const maps: IdMaps = {
    mediaIdMap: new Map<Id, Id>(),
    formIdMap: new Map<Id, Id>(),
    userIdMap: new Map<Id, Id>(),
    instructorIdMap: new Map<Id, Id>(),
    classOptionIdMap: new Map<Id, Id>(),
    lessonIdMap: new Map<Id, Id>(),
    planIdMap: new Map<Id, Id>(),
    dropInIdMap: new Map<Id, Id>(),
    subscriptionIdMap: new Map<Id, Id>(),
    bookingIdMap: new Map<Id, Id>(),
    transactionIdMap: new Map<Id, Id>(),
    classPassTypeIdMap: new Map<Id, Id>(),
    classPassIdMap: new Map<Id, Id>(),
  }

  try {
    // Phase 1: Media (optional; often needs file copy). Intentionally skipped by default.
    if (!args.skipMedia) {
      console.warn(
        '⚠️  Media migration is not implemented automatically yet (uploads need file data). Use --skip-media or add file copy logic.',
      )
    }

    // Phase 1.5: Users
    if (!args.skipUsers) {
      await migrateUsers(sourcePool, targetPool, payload, req, tenantId, maps, args)
    }

    // Phase 1.6: Booking-related data (dependency order)
    if (!args.skipBookingData) {
      await migratePlans(sourcePool, payload, req, tenantId, maps, args)
      await migrateDropIns(sourcePool, payload, req, tenantId, maps, args)
      await migrateEventTypes(sourcePool, payload, req, tenantId, maps, args)
      await migrateStaffMembers(sourcePool, payload, req, tenantId, maps, args)
      await migrateTimeslots(sourcePool, payload, req, tenantId, maps, args)
      await migrateSubscriptions(sourcePool, payload, req, tenantId, maps, args)
      await migrateBookings(sourcePool, payload, req, tenantId, maps, args)
      await migrateTransactions(sourcePool, payload, req, tenantId, maps, args)
    }

    // Phase 2: Forms
    if (!args.skipForms) {
      await migrateForms(sourcePool, payload, req, tenantId, maps, args)
    }

    // Phase 3: Pages
    if (!args.skipPages) {
      await migratePages(sourcePool, payload, req, tenantId, maps, args)
    }

    // Phase 4: Navbar/Footer collections
    if (!args.skipNavbarFooter) {
      console.warn(
        '⚠️  Navbar/Footer migration is not implemented yet. In atnd-me these are tenant-scoped collections (not globals).',
      )
    }

    console.log('✅ Migration completed (or simulated via --dry-run).')
  } finally {
    await sourcePool.end()
    await targetPool.end()
    await payload.db?.destroy?.()
  }
}

main().catch((err) => {
  console.error('❌ Migration failed:', err)
  process.exit(1)
})

