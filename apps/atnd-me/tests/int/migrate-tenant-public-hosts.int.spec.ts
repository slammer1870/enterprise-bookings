/**
 * The one-shot hostname-list migration reads legacy rows and writes the list and Direction.
 *
 * Run with: pnpm test:int -- migrate-tenant-public-hosts
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { getPayload, type Payload } from 'payload'
import { sql, type MigrateUpArgs } from '@payloadcms/db-postgres'
import config from '@/payload.config'
import { createOrGetCustomHostname } from '@/lib/cloudflare/customHostnames'
import { registerApplePayDomain } from '@/collections/Tenants/registerApplePayDomain'
import {
  down,
  readLegacyTenantPublicHostRows,
  writeHostnameLists,
} from '@/migrations/20261016_000002_migrate_hostname_list'
import {
  publicHostRowsToWrite,
  type LegacyTenantPublicHostRow,
} from '@/utilities/migrateTenantPublicHosts'
import { findTenantByHost } from '@/lib/tenantDbResolve'
import type { Tenant } from '@repo/shared-types'

vi.mock('@/lib/cloudflare/customHostnames', () => ({
  createOrGetCustomHostname: vi.fn().mockResolvedValue({
    id: 'csh_test',
    verificationTxtValue: 'txt-token-mock',
    status: 'pending',
  }),
}))

vi.mock('@/collections/Tenants/registerApplePayDomain', () => ({
  registerApplePayDomain: vi.fn().mockResolvedValue(undefined),
  applePayDomainsForDeclaration: vi.fn().mockReturnValue(null),
}))

const TEST_TIMEOUT = 60_000
const stamp = Date.now()

type LegacyFields = {
  domain: string | null
  redirectApex: boolean
  apexDomain: string | null
  aliasHosts: string[]
}

type StoredRow = LegacyFields & {
  hostnames: string[] | null
  direction: string | null
}

describe('legacy hostname list migration', () => {
  let payload: Payload
  let ordered: Tenant
  let wwwRedirect: Tenant
  let emptyParent: Tenant
  let apexWww: Tenant
  let bare: Tenant
  let loneApex: Tenant
  let classes: Tenant
  let bru: Tenant | null = null
  let createdBru = false
  let bruSnapshot: StoredRow | null = null
  let fixtures: LegacyTenantPublicHostRow[] = []

  const orderedDomain = `Shop.Mig${stamp}.com`
  const orderedHost = `shop.mig${stamp}.com`
  const orderedExtra = `extra.mig${stamp}.net`
  const orderedExtraMixed = `EXTRA.Mig${stamp}.net`

  const wwwDomain = `WWW.Mig${stamp}.com`
  const wwwHost = `www.mig${stamp}.com`
  const wwwParentStored = `Mig${stamp}.com`
  const wwwParent = `mig${stamp}.com`
  const wwwBooking = `booking.mig${stamp}.com`

  const loneWww = `www.lone${stamp}.com`

  const apexHost = `apex${stamp}.com`
  const apexWwwHost = `www.apex${stamp}.com`
  const apexWwwStored = `WWW.Apex${stamp}.com`
  const apexNotes = `notes.apex${stamp}.net`

  const bareParent = `parent.bare${stamp}.com`
  const bareDecoy = `decoy.bare${stamp}.com`

  const loneHost = `lone${stamp}.com`

  const classesHost = `classes.ex${stamp}.com`
  const classesParent = `ex${stamp}.com`

  const bruDomain = 'WWW.Brugrappling.ie'
  const bruAlias = 'Keep-Me.Example.net'
  const bruAliasHost = 'keep-me.example.net'

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })
    const db = payload.db.drizzle
    if (!db) throw new Error('Postgres adapter is not ready.')

    ordered = await createTenant(payload, `Mig ordered ${stamp}`, `mig-ordered-${stamp}`)
    wwwRedirect = await createTenant(payload, `Mig www ${stamp}`, `mig-www-${stamp}`)
    emptyParent = await createTenant(payload, `Mig empty ${stamp}`, `mig-empty-${stamp}`)
    apexWww = await createTenant(payload, `Mig apex ${stamp}`, `mig-apex-${stamp}`)
    bare = await createTenant(payload, `Mig bare ${stamp}`, `mig-bare-${stamp}`)
    loneApex = await createTenant(payload, `Mig lone ${stamp}`, `mig-lone-${stamp}`)
    classes = await createTenant(payload, `Mig classes ${stamp}`, `mig-classes-${stamp}`)

    const existingBru = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: 'brugrappling' } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (existingBru.docs[0]) {
      bru = existingBru.docs[0] as Tenant
      bruSnapshot = await storedRow(payload, bru.id)
    } else {
      bru = await createTenant(payload, `Mig Bru ${stamp}`, 'brugrappling')
      createdBru = true
    }

    await arrangeLegacy(db, ordered.id, {
      domain: orderedDomain,
      redirectApex: false,
      apexDomain: null,
      aliasHosts: [orderedHost, orderedExtra, orderedExtraMixed],
    })
    await arrangeLegacy(db, wwwRedirect.id, {
      domain: wwwDomain,
      redirectApex: true,
      apexDomain: wwwParentStored,
      aliasHosts: [wwwBooking, wwwParent],
    })
    await arrangeLegacy(db, emptyParent.id, {
      domain: loneWww,
      redirectApex: true,
      apexDomain: null,
      aliasHosts: [],
    })
    await arrangeLegacy(db, apexWww.id, {
      domain: apexHost,
      redirectApex: false,
      apexDomain: null,
      aliasHosts: [apexNotes, apexWwwStored],
    })
    await arrangeLegacy(db, bare.id, {
      domain: null,
      redirectApex: true,
      apexDomain: bareParent,
      aliasHosts: [bareDecoy],
    })
    await arrangeLegacy(db, loneApex.id, {
      domain: loneHost,
      redirectApex: true,
      apexDomain: loneHost,
      aliasHosts: [],
    })
    await arrangeLegacy(db, classes.id, {
      domain: classesHost,
      redirectApex: true,
      apexDomain: classesParent,
      aliasHosts: [],
    })
    if (bru) {
      await arrangeLegacy(db, bru.id, {
        domain: bruDomain,
        redirectApex: true,
        apexDomain: 'brugrappling.ie',
        aliasHosts: [bruAlias, 'www.brugrappling.ie', 'brugrappling.ie'],
      })
    }

    const legacy = await readLegacyTenantPublicHostRows(db)
    const fixtureIds = new Set(
      [
        ordered.id,
        wwwRedirect.id,
        emptyParent.id,
        apexWww.id,
        bare.id,
        loneApex.id,
        classes.id,
        bru?.id,
      ]
        .filter((id) => id != null)
        .map((id) => String(id)),
    )
    fixtures = legacy.filter((row) => fixtureIds.has(String(row.id)))

    vi.mocked(createOrGetCustomHostname).mockClear()
    vi.mocked(registerApplePayDomain).mockClear()
    await writeHostnameLists(db, publicHostRowsToWrite(fixtures))
  }, TEST_TIMEOUT)

  afterAll(async () => {
    const db = payload?.db.drizzle
    if (bru && !createdBru && bruSnapshot && db) {
      await restoreRow(db, bru.id, bruSnapshot)
    }
    const ids = [
      ordered?.id,
      wwwRedirect?.id,
      emptyParent?.id,
      apexWww?.id,
      bare?.id,
      loneApex?.id,
      classes?.id,
      createdBru ? bru?.id : null,
    ].filter((id) => id != null)
    for (const id of ids) {
      await payload.delete({ collection: 'tenants', id, overrideAccess: true })
    }
  }, TEST_TIMEOUT)

  it('reads the stored custom domain, alias hosts, Redirect apex, and stored parent', () => {
    expect(fixtures.find((row) => String(row.id) === String(ordered.id))).toMatchObject({
      domain: orderedDomain,
      redirectApex: false,
      apexDomain: null,
      aliasHosts: [orderedHost, orderedExtra, orderedExtraMixed],
    })
    expect(fixtures.find((row) => String(row.id) === String(wwwRedirect.id))).toMatchObject({
      domain: wwwDomain,
      redirectApex: true,
      apexDomain: wwwParentStored,
      aliasHosts: [wwwBooking, wwwParent],
    })
    expect(fixtures.find((row) => String(row.id) === String(bare.id))).toMatchObject({
      domain: null,
      redirectApex: true,
      apexDomain: bareParent,
      aliasHosts: [bareDecoy],
    })
  })

  it('puts the custom domain first and lists each other alias once', async () => {
    expect(await storedRow(payload, ordered.id)).toMatchObject({
      hostnames: [orderedHost, orderedExtra],
      direction: 'allow-www-and-non-www',
      domain: orderedDomain,
      aliasHosts: [orderedHost, orderedExtra, orderedExtraMixed],
      redirectApex: false,
      apexDomain: null,
    })
  }, TEST_TIMEOUT)

  it('maps www with Redirect apex and a stored parent to www, then that parent, with Redirect to www', async () => {
    expect(await storedRow(payload, wwwRedirect.id)).toMatchObject({
      hostnames: [wwwHost, wwwParent, wwwBooking],
      direction: 'redirect-to-www',
      domain: wwwDomain,
      aliasHosts: [wwwBooking, wwwParent],
      redirectApex: true,
      apexDomain: wwwParentStored,
    })

    expect(await findTenantByHost(payload, wwwHost)).toMatchObject({
      type: 'domain',
      id: wwwRedirect.id,
      indexedHost: wwwHost,
    })
    expect(await findTenantByHost(payload, wwwParent)).toMatchObject({
      type: 'alias',
      id: wwwRedirect.id,
      canonicalHost: wwwHost,
    })
    expect(await findTenantByHost(payload, wwwBooking)).toMatchObject({
      type: 'domain',
      id: wwwRedirect.id,
      indexedHost: wwwHost,
    })
  }, TEST_TIMEOUT)

  it('leaves an empty stored parent off the list and keeps a lone www host on Allow www and non-www', async () => {
    expect(await storedRow(payload, emptyParent.id)).toMatchObject({
      hostnames: [loneWww],
      direction: 'allow-www-and-non-www',
      domain: loneWww,
      redirectApex: true,
      apexDomain: null,
      aliasHosts: [],
    })
  }, TEST_TIMEOUT)

  it('maps an apex whose www is already an alias to that apex, then www, with Redirect to non-www', async () => {
    expect(await storedRow(payload, apexWww.id)).toMatchObject({
      hostnames: [apexHost, apexWwwHost, apexNotes],
      direction: 'redirect-to-non-www',
      domain: apexHost,
      redirectApex: false,
      apexDomain: null,
      aliasHosts: [apexNotes, apexWwwStored],
    })

    expect(await findTenantByHost(payload, apexHost)).toMatchObject({
      type: 'domain',
      id: apexWww.id,
      indexedHost: apexHost,
    })
    expect(await findTenantByHost(payload, apexWwwHost)).toMatchObject({
      type: 'alias',
      id: apexWww.id,
      canonicalHost: apexHost,
    })
  }, TEST_TIMEOUT)

  it('maps Bru Grappling to the apex, then www, with Redirect to non-www while the stored custom domain is still www', async () => {
    expect(bru).not.toBeNull()
    expect(await storedRow(payload, bru!.id)).toMatchObject({
      hostnames: ['brugrappling.ie', 'www.brugrappling.ie', bruAliasHost],
      direction: 'redirect-to-non-www',
      domain: bruDomain,
      redirectApex: true,
      apexDomain: 'brugrappling.ie',
    })

    expect(await findTenantByHost(payload, 'brugrappling.ie')).toMatchObject({
      type: 'domain',
      id: bru!.id,
      indexedHost: 'brugrappling.ie',
    })
    expect(await findTenantByHost(payload, 'www.brugrappling.ie')).toMatchObject({
      type: 'alias',
      id: bru!.id,
      canonicalHost: 'brugrappling.ie',
    })
  }, TEST_TIMEOUT)

  it('stores an empty list and Allow www and non-www when there is no custom domain, and leaves alias hosts off the list', async () => {
    expect(await storedRow(payload, bare.id)).toMatchObject({
      hostnames: [],
      direction: 'allow-www-and-non-www',
      domain: null,
      redirectApex: true,
      apexDomain: bareParent,
      aliasHosts: [bareDecoy],
    })
    expect(await findTenantByHost(payload, bareDecoy)).toBeNull()
    expect(await findTenantByHost(payload, bareParent)).toBeNull()
  }, TEST_TIMEOUT)

  it('stores a lone apex, and a hostname that is neither www nor the apex, with Allow www and non-www', async () => {
    expect(await storedRow(payload, loneApex.id)).toMatchObject({
      hostnames: [loneHost],
      direction: 'allow-www-and-non-www',
      domain: loneHost,
      redirectApex: true,
      apexDomain: loneHost,
    })
    expect(await storedRow(payload, classes.id)).toMatchObject({
      hostnames: [classesHost],
      direction: 'allow-www-and-non-www',
      domain: classesHost,
      redirectApex: true,
      apexDomain: classesParent,
      aliasHosts: [],
    })
    expect(await findTenantByHost(payload, classesHost)).toMatchObject({
      type: 'domain',
      id: classes.id,
      indexedHost: classesHost,
    })
    expect(await findTenantByHost(payload, classesParent)).toBeNull()
  }, TEST_TIMEOUT)

  it('writes the row without calling DNS or certificate registration', () => {
    expect(createOrGetCustomHostname).not.toHaveBeenCalled()
    expect(registerApplePayDomain).not.toHaveBeenCalled()
  })

  it('leaves the hostname list in place when the migration is rolled down', async () => {
    const db = payload.db.drizzle
    if (!db) throw new Error('Postgres adapter is not ready.')
    await down({ db } as Parameters<typeof down>[0])
    expect(await storedRow(payload, wwwRedirect.id)).toMatchObject({
      hostnames: [wwwHost, wwwParent, wwwBooking],
      direction: 'redirect-to-www',
      domain: wwwDomain,
      redirectApex: true,
      apexDomain: wwwParentStored,
    })
  }, TEST_TIMEOUT)
})

async function createTenant(payload: Payload, name: string, slug: string): Promise<Tenant> {
  return (await payload.create({
    collection: 'tenants',
    data: { name, slug },
    overrideAccess: true,
  })) as Tenant
}

async function arrangeLegacy(
  db: MigrateUpArgs['db'],
  id: number | string,
  fields: LegacyFields,
): Promise<void> {
  await db.execute(sql`
    UPDATE "tenants"
    SET "domain" = ${fields.domain},
        "redirect_apex" = ${fields.redirectApex},
        "apex_domain" = ${fields.apexDomain}
    WHERE "id" = ${id}
  `)
  await db.execute(sql`
    DELETE FROM "tenants_texts"
    WHERE "parent_id" = ${id} AND "path" = 'aliasHosts'
  `)
  for (const [index, host] of fields.aliasHosts.entries()) {
    await db.execute(sql`
      INSERT INTO "tenants_texts" ("order", "parent_id", "path", "text")
      VALUES (${index + 1}, ${id}, 'aliasHosts', ${host})
    `)
  }
}

async function storedRow(payload: Payload, id: number | string): Promise<StoredRow> {
  const tenant = await payload.findByID({
    collection: 'tenants',
    id,
    depth: 0,
    overrideAccess: true,
  })
  const hostnames = Array.isArray(tenant.hostnames)
    ? tenant.hostnames.filter((host): host is string => typeof host === 'string')
    : null
  const aliasHosts = Array.isArray(tenant.aliasHosts)
    ? tenant.aliasHosts.filter((host): host is string => typeof host === 'string')
    : []
  return {
    hostnames,
    direction: typeof tenant.direction === 'string' ? tenant.direction : null,
    domain: typeof tenant.domain === 'string' && tenant.domain.trim() ? tenant.domain : null,
    aliasHosts,
    redirectApex: tenant.redirectApex === true,
    apexDomain: typeof tenant.apexDomain === 'string' && tenant.apexDomain.trim() ? tenant.apexDomain : null,
  }
}

async function restoreRow(
  db: MigrateUpArgs['db'],
  id: number | string,
  snapshot: StoredRow,
): Promise<void> {
  const hostnames =
    snapshot.hostnames === null ? null : JSON.stringify(snapshot.hostnames)
  await db.execute(sql`
    UPDATE "tenants"
    SET "domain" = ${snapshot.domain},
        "redirect_apex" = ${snapshot.redirectApex},
        "apex_domain" = ${snapshot.apexDomain},
        "hostnames" = ${hostnames}::jsonb,
        "direction" = ${snapshot.direction ?? 'allow-www-and-non-www'}::"public"."enum_tenants_direction"
    WHERE "id" = ${id}
  `)
  await arrangeLegacy(db, id, snapshot)
}
