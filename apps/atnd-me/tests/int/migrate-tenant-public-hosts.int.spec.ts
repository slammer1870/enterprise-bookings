/**
 * The one-shot public-host migration reads legacy rows and writes the declaration.
 *
 * Run with: pnpm test:int -- migrate-tenant-public-hosts
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { getPayload, type Payload } from 'payload'
import { sql, type MigrateUpArgs } from '@payloadcms/db-postgres'
import config from '@/payload.config'
import {
  down,
  readLegacyTenantPublicHostRows,
  writePublicHostDeclarations,
} from '@/migrations/20261013_000001_migrate_tenant_public_hosts'
import { publicHostRowsToWrite } from '@/utilities/migrateTenantPublicHosts'
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
}))

const TEST_TIMEOUT = 60_000
const stamp = Date.now()

type StoredDeclaration = {
  canonicalHost: string | null
  aliasHosts: string[]
  platformSubdomainRole: 'canonical' | 'alias'
}

describe('legacy public host migration', () => {
  let payload: Payload
  let wwwTenant: Tenant
  let bareTenant: Tenant
  let bruTenant: Tenant | null = null
  let createdBru = false

  const wwwSlug = `mig-www-${stamp}`
  const bareSlug = `mig-bare-${stamp}`
  const mixedDomain = `WWW.Mig${stamp}.com`
  const canonicalHost = `www.mig${stamp}.com`
  const apexAlias = `mig${stamp}.com`
  const bruDomain = 'WWW.Brugrappling.ie'
  const bruDecoy = 'keep-me.example.net'

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    wwwTenant = (await payload.create({
      collection: 'tenants',
      data: { name: `Mig www ${stamp}`, slug: wwwSlug },
      overrideAccess: true,
    })) as Tenant

    bareTenant = (await payload.create({
      collection: 'tenants',
      data: { name: `Mig bare ${stamp}`, slug: bareSlug },
      overrideAccess: true,
    })) as Tenant

    const existingBru = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: 'brugrappling' } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (existingBru.docs[0]) {
      bruTenant = existingBru.docs[0] as Tenant
    } else {
      bruTenant = (await payload.create({
        collection: 'tenants',
        data: { name: `Mig Bru ${stamp}`, slug: 'brugrappling' },
        overrideAccess: true,
      })) as Tenant
      createdBru = true
    }
  }, TEST_TIMEOUT)

  afterAll(async () => {
    const ids = [wwwTenant?.id, bareTenant?.id, createdBru ? bruTenant?.id : null].filter(
      (id) => id != null,
    )
    for (const id of ids) {
      await payload.delete({ collection: 'tenants', id, overrideAccess: true })
    }
  }, TEST_TIMEOUT)

  it(
    'stores the canonical host and alias hosts from domain and redirectApex',
    async () => {
      const db = payload.db.drizzle
      if (!db) throw new Error('Postgres adapter is not ready.')

      await db.execute(sql`
        UPDATE "tenants"
        SET "domain" = ${mixedDomain}, "redirect_apex" = true
        WHERE "id" = ${wwwTenant.id}
      `)
      await db.execute(sql`
        UPDATE "tenants"
        SET "domain" = NULL, "redirect_apex" = true
        WHERE "id" = ${bareTenant.id}
      `)
      await insertAlias(db, wwwTenant.id, 'decoy.example.com')
      await insertAlias(db, bareTenant.id, 'decoy.example.com')

      if (createdBru && bruTenant) {
        await db.execute(sql`
          UPDATE "tenants"
          SET "domain" = ${bruDomain}, "redirect_apex" = true
          WHERE "id" = ${bruTenant.id}
        `)
        await insertAlias(db, bruTenant.id, bruDecoy)
      }

      const bruBefore = bruTenant ? await storedDeclaration(payload, bruTenant.id) : null

      const legacy = await readLegacyTenantPublicHostRows(db)
      const fixtureIds = new Set(
        [wwwTenant.id, bareTenant.id, bruTenant?.id]
          .filter((id) => id != null)
          .map((id) => String(id)),
      )
      const fixtures = legacy.filter((row) => fixtureIds.has(String(row.id)))

      expect(fixtures.find((row) => String(row.id) === String(wwwTenant.id))).toMatchObject({
        slug: wwwSlug,
        domain: mixedDomain,
        redirectApex: true,
      })
      expect(fixtures.find((row) => String(row.id) === String(bareTenant.id))).toMatchObject({
        slug: bareSlug,
        domain: null,
        redirectApex: true,
      })

      await writePublicHostDeclarations(db, publicHostRowsToWrite(fixtures, { bruCutover: false }))

      expect(await storedDeclaration(payload, wwwTenant.id)).toEqual({
        canonicalHost,
        aliasHosts: [apexAlias],
        platformSubdomainRole: 'alias',
      })
      expect(await storedDeclaration(payload, bareTenant.id)).toEqual({
        canonicalHost: null,
        aliasHosts: [],
        platformSubdomainRole: 'canonical',
      })

      if (bruTenant && bruBefore) {
        const expectedBru = createdBru
          ? {
              canonicalHost: bruDomain,
              aliasHosts: [bruDecoy],
              platformSubdomainRole: 'alias' as const,
            }
          : bruBefore
        expect(await storedDeclaration(payload, bruTenant.id)).toEqual(expectedBru)
      }

      await down({ db } as Parameters<typeof down>[0])

      expect(await storedDeclaration(payload, wwwTenant.id)).toEqual({
        canonicalHost,
        aliasHosts: [apexAlias],
        platformSubdomainRole: 'alias',
      })
    },
    TEST_TIMEOUT,
  )
})

async function insertAlias(
  db: MigrateUpArgs['db'],
  parentId: number | string,
  host: string,
): Promise<void> {
  await db.execute(sql`
    INSERT INTO "tenants_texts" ("order", "parent_id", "path", "text")
    VALUES (1, ${parentId}, 'aliasHosts', ${host})
  `)
}

async function storedDeclaration(payload: Payload, id: number | string): Promise<StoredDeclaration> {
  const tenant = await payload.findByID({
    collection: 'tenants',
    id,
    depth: 0,
    overrideAccess: true,
  })
  const canonicalHost =
    typeof tenant.domain === 'string' && tenant.domain.trim() ? tenant.domain : null
  const aliasHosts = Array.isArray(tenant.aliasHosts)
    ? tenant.aliasHosts.filter((host): host is string => typeof host === 'string')
    : []
  return {
    canonicalHost,
    aliasHosts,
    platformSubdomainRole: canonicalHost ? 'alias' : 'canonical',
  }
}
