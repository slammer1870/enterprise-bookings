#!/usr/bin/env tsx
/**
 * One-off migration: bru-grappling → atnd-me tenant (content + custom blocks).
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
 * Then run without --dry-run.
 */

import 'dotenv/config'

import { createLocalReq } from 'payload'
import { Pool } from 'pg'

import { getPayload } from '@/lib/payload'
import { checkRole } from '@repo/shared-utils'
import type { User } from '@repo/shared-types'

type Id = string | number

type Args = {
  dryRun: boolean
  tenantId?: string
  tenantSlug?: string
  sourceDatabaseUri?: string
  limit?: number
  skipMedia: boolean
  skipForms: boolean
  skipPages: boolean
  skipNavbarFooter: boolean
}

function parseArgs(argv: string[]): Args {
  const out: Args = {
    dryRun: false,
    skipMedia: false,
    skipForms: false,
    skipPages: false,
    skipNavbarFooter: false,
  }

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dry-run') out.dryRun = true
    else if (a === '--tenant-id') out.tenantId = argv[++i]
    else if (a === '--tenant-slug') out.tenantSlug = argv[++i]
    else if (a === '--source-database-uri') out.sourceDatabaseUri = argv[++i]
    else if (a === '--limit') out.limit = Number(argv[++i])
    else if (a === '--skip-media') out.skipMedia = true
    else if (a === '--skip-forms') out.skipForms = true
    else if (a === '--skip-pages') out.skipPages = true
    else if (a === '--skip-navbar-footer') out.skipNavbarFooter = true
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
  const found = await payload.find({
    collection: 'users',
    where: { roles: { contains: 'admin' } },
    limit: 1,
    overrideAccess: true,
  })

  const user = found.docs[0] || null
  if (!user || !checkRole(['admin'], user as unknown as User)) {
    console.error('❌ No admin user found (or roles misconfigured). Create an admin user first.')
    process.exit(1)
  }

  return await createLocalReq({ user: { ...user, collection: 'users' } }, payload)
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
}

function mapBlockType(oldType: string): string {
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
    case 'contact':
      return 'bruContact'
    case 'hero-waitlist':
      return 'bruHeroWaitlist'
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

function remapPageLayout(layout: unknown, maps: IdMaps): unknown {
  if (!Array.isArray(layout)) return layout
  return layout.map((block) => {
    if (!block || typeof block !== 'object') return block
    const b = block as Record<string, unknown>
    const blockType = typeof b.blockType === 'string' ? b.blockType : undefined
    const mapped = blockType ? mapBlockType(blockType) : blockType
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

async function migrateForms(
  pool: Pool,
  payload: Awaited<ReturnType<typeof getPayload>>,
  req: Awaited<ReturnType<typeof createLocalReq>>,
  tenantId: string,
  maps: IdMaps,
  args: Args,
): Promise<void> {
  const limit = args.limit ?? null
  const rows = await queryAll(pool, `select * from forms order by id asc${limit ? ' limit $1' : ''}`, limit ? [limit] : [])

  console.log(`Forms: source rows=${rows.length}`)
  for (const row of rows) {
    const sourceId = row.id as Id
    const data: Record<string, unknown> = {
      ...row,
      id: undefined,
      createdAt: undefined,
      updatedAt: undefined,
      tenant: tenantId,
    }

    if (args.dryRun) {
      maps.formIdMap.set(sourceId, sourceId)
      continue
    }

    const created = await payload.create({
      collection: 'forms',
      data,
      req,
      overrideAccess: true,
      // Script context: allow schema differences between source/target.
    } as any)
    maps.formIdMap.set(sourceId, created.id as Id)
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
  const limit = args.limit ?? null
  const rows = await queryAll(pool, `select * from pages order by id asc${limit ? ' limit $1' : ''}`, limit ? [limit] : [])

  console.log(`Pages: source rows=${rows.length}`)
  for (const row of rows) {
    const data: Record<string, unknown> = { ...row }

    // Payload DB rows typically have id + timestamps; strip and re-create.
    delete data.id
    delete data.createdAt
    delete data.updatedAt

    data.tenant = tenantId
    if ('layout' in row) data.layout = remapPageLayout((row as any).layout, maps)

    if (args.dryRun) continue

    await payload.create({
      collection: 'pages',
      data,
      req,
      overrideAccess: true,
      // Script context: allow schema differences between source/target.
    } as any)
  }
}

async function main() {
  blockInProduction()

  const args = parseArgs(process.argv.slice(2))
  const sourceDatabaseUri =
    args.sourceDatabaseUri || process.env.BRU_SOURCE_DATABASE_URI || process.env.SOURCE_DATABASE_URI

  if (!process.env.DATABASE_URI) {
    console.error('❌ DATABASE_URI must be set for atnd-me target DB')
    process.exit(1)
  }
  if (!sourceDatabaseUri) {
    console.error('❌ Missing source DB connection string. Provide BRU_SOURCE_DATABASE_URI or --source-database-uri')
    process.exit(1)
  }

  const payload = await getPayload()
  const req = await getAdminReq(payload)
  const tenantId = await resolveTenantId(payload, args)

  console.log(`Target tenant id: ${tenantId}`)
  console.log(`Dry run: ${args.dryRun ? 'yes' : 'no'}`)

  const sourcePool = new Pool({ connectionString: sourceDatabaseUri })
  const maps: IdMaps = {
    mediaIdMap: new Map<Id, Id>(),
    formIdMap: new Map<Id, Id>(),
  }

  try {
    // Phase 1: Media (optional; often needs file copy). Intentionally skipped by default.
    if (!args.skipMedia) {
      console.warn(
        '⚠️  Media migration is not implemented automatically yet (uploads need file data). Use --skip-media or add file copy logic.',
      )
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
    await payload.db?.destroy?.()
  }
}

main().catch((err) => {
  console.error('❌ Migration failed:', err)
  process.exit(1)
})

