/**
 * Phase 7 Chunk 7 — `getLocationContext`: pathname `/locations/:slug` + `branch-slug` cookie, tenant-scoped.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import type { Tenant } from '@repo/shared-types'
import { getLocationContext } from '@/utilities/getLocationContext'
import { PUBLIC_BRANCH_SLUG_COOKIE } from '@/utilities/tenantRequest'

const HOOK_TIMEOUT = 300000
const TEST_TIMEOUT = 60000

function cookiesWith(values: Record<string, string>): {
  get: (name: string) => { value?: string } | undefined
} {
  return {
    get: (name: string) => (values[name] != null ? { value: values[name] } : undefined),
  }
}

describe('getLocationContext (tenant-scoped branch)', () => {
  let payload: Payload
  let tenantA: Tenant
  let tenantB: Tenant
  let locA: { id: number; slug: string }
  let locB: { id: number; slug: string }
  let locInactive: { id: number; slug: string }

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })
    const ts = Date.now()

    tenantA = (await payload.create({
      collection: 'tenants',
      data: { name: 'Loc Ctx A', slug: `loc-ctx-a-${ts}` },
      overrideAccess: true,
    })) as Tenant

    tenantB = (await payload.create({
      collection: 'tenants',
      data: { name: 'Loc Ctx B', slug: `loc-ctx-b-${ts}` },
      overrideAccess: true,
    })) as Tenant

    locA = await payload.create({
      collection: 'locations',
      data: { tenant: tenantA.id, name: 'Dublin A', slug: 'dublin' },
      overrideAccess: true,
    })

    locB = await payload.create({
      collection: 'locations',
      data: { tenant: tenantB.id, name: 'Dublin B', slug: 'dublin' },
      overrideAccess: true,
    })

    locInactive = await payload.create({
      collection: 'locations',
      data: {
        tenant: tenantA.id,
        name: 'Closed site',
        slug: 'closed',
        active: false,
      },
      overrideAccess: true,
    })
  }, HOOK_TIMEOUT)

  afterAll(async () => {
    if (!payload) return
    try {
      await payload.delete({
        collection: 'locations',
        where: {
          id: { in: [locA.id, locB.id, locInactive.id] },
        },
        overrideAccess: true,
      })
      await payload.delete({
        collection: 'tenants',
        where: { id: { in: [tenantA.id, tenantB.id] } },
        overrideAccess: true,
      })
    } catch {
      // ignore
    }
    await payload.db?.destroy?.()
  })

  it(
    'resolves same slug for tenant A only (cross-tenant isolation)',
    async () => {
      const ctxA = await getLocationContext(payload, {
        tenantId: tenantA.id,
        source: { pathname: '/locations/dublin', cookies: cookiesWith({}) },
      })
      expect(ctxA?.id).toBe(locA.id)
      expect(ctxA?.tenantId).toBe(tenantA.id)

      const ctxB = await getLocationContext(payload, {
        tenantId: tenantB.id,
        source: { pathname: '/locations/dublin', cookies: cookiesWith({}) },
      })
      expect(ctxB?.id).toBe(locB.id)
      expect(ctxB?.tenantId).toBe(tenantB.id)
    },
    TEST_TIMEOUT,
  )

  it(
    'prefers pathname slug over branch-slug cookie',
    async () => {
      const ctx = await getLocationContext(payload, {
        tenantId: tenantA.id,
        source: {
          pathname: '/locations/dublin',
          cookies: cookiesWith({
            [PUBLIC_BRANCH_SLUG_COOKIE]: 'closed',
          }),
        },
      })
      expect(ctx?.id).toBe(locA.id)
    },
    TEST_TIMEOUT,
  )

  it(
    'falls back to branch-slug cookie when pathname has no /locations segment',
    async () => {
      const ctx = await getLocationContext(payload, {
        tenantId: tenantA.id,
        source: {
          pathname: '/schedule',
          cookies: cookiesWith({ [PUBLIC_BRANCH_SLUG_COOKIE]: 'dublin' }),
        },
      })
      expect(ctx?.id).toBe(locA.id)
    },
    TEST_TIMEOUT,
  )

  it(
    'returns null for unknown slug',
    async () => {
      const ctx = await getLocationContext(payload, {
        tenantId: tenantA.id,
        source: { pathname: '/locations/unknown-town', cookies: cookiesWith({}) },
      })
      expect(ctx).toBeNull()
    },
    TEST_TIMEOUT,
  )

  it(
    'does not fall back to cookie when pathname slug is present but invalid',
    async () => {
      const ctx = await getLocationContext(payload, {
        tenantId: tenantA.id,
        source: {
          pathname: '/locations/unknown-town',
          cookies: cookiesWith({ [PUBLIC_BRANCH_SLUG_COOKIE]: 'dublin' }),
        },
      })
      expect(ctx).toBeNull()
    },
    TEST_TIMEOUT,
  )

  it(
    'ignores inactive locations',
    async () => {
      const ctx = await getLocationContext(payload, {
        tenantId: tenantA.id,
        source: {
          pathname: '/locations/closed',
          cookies: cookiesWith({}),
        },
      })
      expect(ctx).toBeNull()
    },
    TEST_TIMEOUT,
  )
})
