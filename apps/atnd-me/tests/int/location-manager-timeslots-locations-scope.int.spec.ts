/**
 * Phase 7 Chunk 6 — pure `location-manager`: timeslots + locations read scope; no location writes; no Pages reads.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import type { User, Tenant } from '@repo/shared-types'
import { PAYLOAD_LOCATION_COOKIE } from '@/utilities/tenantRequest'

const HOOK_TIMEOUT = 300000
const TEST_TIMEOUT = 60000

function adminReqWithCookies(
  payload: Payload,
  user: User,
  cookies: Record<string, string>,
): Record<string, unknown> {
  return {
    ...payload,
    user,
    cookies: {
      get: (name: string) => (cookies[name] != null ? { value: cookies[name] } : undefined),
    },
  } as Record<string, unknown>
}

describe('location-manager timeslots + locations scope', () => {
  let payload: Payload
  let bootstrap: User
  let tenant: Tenant
  let locA: { id: number }
  let locB: { id: number }
  let lm: User
  let eventTypeId: number
  let timeslotBranchA: number
  let timeslotBranchB: number
  let pageId: number | null = null

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })
    const ts = Date.now()

    tenant = (await payload.create({
      collection: 'tenants',
      data: { name: 'LM Scope Tenant', slug: `lm-scope-t-${ts}`, allowedBlocks: ['location'] },
      overrideAccess: true,
    })) as Tenant

    bootstrap = (await payload.create({
      collection: 'users',
      data: {
        name: 'Bootstrap super-admin (LM scope)',
        email: `bootstrap-lm-scope-${ts}@test.com`,
        password: 'test',
        role: ['super-admin'],
        emailVerified: true,
      },
      draft: false,
      overrideAccess: true,
    } as Parameters<typeof payload.create>[0])) as User

    locA = await payload.create({
      collection: 'locations',
      data: { tenant: tenant.id, name: 'LM Scope Branch A', slug: `lm-sc-a-${ts}` },
      overrideAccess: true,
    })

    locB = await payload.create({
      collection: 'locations',
      data: { tenant: tenant.id, name: 'LM Scope Branch B', slug: `lm-sc-b-${ts}` },
      overrideAccess: true,
    })

    lm = (await payload.create({
      collection: 'users',
      data: {
        name: 'Pure Site Manager',
        email: `lm-scope-${ts}@test.com`,
        password: 'test',
        role: ['location-manager'],
        emailVerified: true,
        tenants: [{ tenant: tenant.id, roles: ['location-manager'] }],
        locations: [locA.id],
      },
      draft: false,
      overrideAccess: true,
    } as Parameters<typeof payload.create>[0])) as User

    const et = await payload.create({
      collection: 'event-types',
      data: {
        name: `LM scope class ${ts}`,
        places: 6,
        description: 'Test',
        tenant: tenant.id,
      },
      overrideAccess: true,
    })
    eventTypeId = et.id as number

    const mkSlot = async (ordinal: number, branchId: number) => {
      const start = new Date()
      start.setUTCDate(start.getUTCDate() + 6)
      start.setUTCHours(9 + ordinal, 0, 0, 0)
      const end = new Date(start.getTime() + 60 * 60 * 1000)
      const doc = await payload.create({
        collection: 'timeslots',
        data: {
          tenant: tenant.id,
          branch: branchId,
          eventType: eventTypeId,
          date: start.toISOString().split('T')[0],
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          lockOutTime: 0,
          active: true,
        },
        overrideAccess: true,
      })
      return doc.id as number
    }

    timeslotBranchA = await mkSlot(0, locA.id)
    timeslotBranchB = await mkSlot(1, locB.id)
  }, HOOK_TIMEOUT)

  afterAll(async () => {
    if (!payload) return
    try {
      if (pageId != null) {
        await payload.delete({ collection: 'pages', id: pageId, overrideAccess: true })
      }
      await payload.delete({
        collection: 'timeslots',
        where: { id: { in: [timeslotBranchA, timeslotBranchB] } },
        overrideAccess: true,
      })
      await payload.delete({
        collection: 'event-types',
        where: { id: { equals: eventTypeId } },
        overrideAccess: true,
      })
      await payload.delete({
        collection: 'locations',
        where: { id: { in: [locA.id, locB.id] } },
        overrideAccess: true,
      })
      await payload.delete({
        collection: 'users',
        where: { id: { in: [lm.id, bootstrap.id] } },
        overrideAccess: true,
      })
      await payload.delete({
        collection: 'tenants',
        where: { id: { equals: tenant.id } },
        overrideAccess: true,
      })
    } catch {
      // ignore
    }
    await payload.db?.destroy?.()
  })

  it(
    'lists only assigned locations for the tenant context',
    async () => {
      const req = {
        ...payload,
        user: lm,
        context: { tenant: tenant.id },
      } as Parameters<typeof payload.find>[0]['req']

      const r = await payload.find({
        collection: 'locations',
        where: {},
        limit: 50,
        req,
        overrideAccess: false,
      })
      const ids = r.docs.map((d) => d.id).sort((a, b) => a - b)
      expect(ids).toEqual([locA.id])
    },
    TEST_TIMEOUT,
  )

  it(
    'scopes timeslots to assigned branch when payload-tenant is set',
    async () => {
      const req = adminReqWithCookies(payload, lm, {
        'payload-tenant': String(tenant.id),
      })

      const res = await payload.find({
        collection: 'timeslots',
        where: {},
        limit: 100,
        req: req as any,
        overrideAccess: false,
      })

      const ids = res.docs.map((d) => d.id)
      expect(ids).toContain(timeslotBranchA)
      expect(ids).not.toContain(timeslotBranchB)
    },
    TEST_TIMEOUT,
  )

  it(
    'does not leak unassigned branch timeslots when payload-location targets another branch',
    async () => {
      const req = adminReqWithCookies(payload, lm, {
        'payload-tenant': String(tenant.id),
        [PAYLOAD_LOCATION_COOKIE]: String(locB.id),
      })

      await expect(
        payload.find({
          collection: 'timeslots',
          where: {},
          limit: 100,
          req: req as any,
          overrideAccess: false,
        }),
      ).rejects.toThrow(/not allowed|Forbidden/i)
    },
    TEST_TIMEOUT,
  )

  it(
    'rejects pure location-manager creating a location',
    async () => {
      const req = {
        ...payload,
        user: lm,
        context: { tenant: tenant.id },
      } as Parameters<typeof payload.create>[0]['req']

      await expect(
        payload.create({
          collection: 'locations',
          data: {
            tenant: tenant.id,
            name: 'Should not exist',
            slug: `lm-deny-${Date.now()}`,
          },
          req,
          overrideAccess: false,
        }),
      ).rejects.toThrow()
    },
    TEST_TIMEOUT,
  )

  it(
    'does not return tenant pages for pure location-manager reads',
    async () => {
      const created = await payload.create({
        collection: 'pages',
        data: {
          title: 'LM pages deny',
          slug: `lm-pages-${Date.now()}`,
          tenant: tenant.id,
          layout: [{ blockType: 'heroScheduleSanctuary', blockName: 'Hero & Schedule' }],
          _status: 'published',
        },
        user: bootstrap,
        overrideAccess: true,
      })
      pageId = created.id as number

      const req = {
        ...payload,
        user: lm,
        context: { tenant: tenant.id },
      } as Parameters<typeof payload.find>[0]['req']

      await expect(
        payload.find({
          collection: 'pages',
          where: { id: { equals: pageId } },
          limit: 5,
          req,
          overrideAccess: false,
        }),
      ).rejects.toThrow(/not allowed|Forbidden/i)
    },
    TEST_TIMEOUT,
  )
})
