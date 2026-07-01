/**
 * Phase 7 Chunk 4 — `timeslotsRead`: `payload-tenant` + optional `payload-location` branch filter + tamper resistance.
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

describe('timeslotsRead branch filter (payload-location)', () => {
  let payload: Payload
  /** First user on a fresh DB is forced to `super-admin` (bootstrap). Create this before the real org admin. */
  let bootstrapSuperAdminId: number
  let orgAdmin: User
  let tenantT: Tenant
  let tenantOther: Tenant
  let locA: { id: number }
  let locB: { id: number }
  let locOther: { id: number }
  let eventTypeT: number
  let eventTypeOther: number
  let timeslotBranchA: number
  let timeslotBranchB: number
  let timeslotOtherTenant: number

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })
    const ts = Date.now()

    tenantT = (await payload.create({
      collection: 'tenants',
      data: { name: 'Read Filter Tenant', slug: `tslot-read-t-${ts}` },
      overrideAccess: true,
    })) as Tenant

    tenantOther = (await payload.create({
      collection: 'tenants',
      data: { name: 'Read Filter Other', slug: `tslot-read-o-${ts}` },
      overrideAccess: true,
    })) as Tenant

    const bootstrap = (await payload.create({
      collection: 'users',
      data: {
        name: 'Bootstrap super-admin',
        email: `bootstrap-read-branch-${ts}@test.com`,
        password: 'test',
        role: ['super-admin'],
        emailVerified: true,
      },
      draft: false,
      overrideAccess: true,
    } as Parameters<typeof payload.create>[0])) as User
    bootstrapSuperAdminId = bootstrap.id

    orgAdmin = (await payload.create({
      collection: 'users',
      data: {
        name: 'Org Admin',
        email: `org-read-branch-${ts}@test.com`,
        password: 'test',
        role: ['admin'],
        emailVerified: true,
        tenants: [{ tenant: tenantT.id, roles: ['admin'] }],
      },
      draft: false,
      overrideAccess: true,
    } as Parameters<typeof payload.create>[0])) as User

    locA = await payload.create({
      collection: 'locations',
      data: { tenant: tenantT.id, name: 'Branch A', slug: `read-br-a-${ts}` },
      overrideAccess: true,
    })

    locB = await payload.create({
      collection: 'locations',
      data: { tenant: tenantT.id, name: 'Branch B', slug: `read-br-b-${ts}` },
      overrideAccess: true,
    })

    locOther = await payload.create({
      collection: 'locations',
      data: { tenant: tenantOther.id, name: 'Other branch', slug: `read-br-oth-${ts}` },
      overrideAccess: true,
    })

    const etT = await payload.create({
      collection: 'event-types',
      data: {
        name: `Read filter class T ${ts}`,
        places: 8,
        description: 'Test',
        tenant: tenantT.id,
      },
      overrideAccess: true,
    })
    eventTypeT = etT.id as number

    const etO = await payload.create({
      collection: 'event-types',
      data: {
        name: `Read filter class O ${ts}`,
        places: 4,
        description: 'Test',
        tenant: tenantOther.id,
      },
      overrideAccess: true,
    })
    eventTypeOther = etO.id as number

    const mkSlot = async (ordinal: number, branchId: number | null, tenantId: number, eventType: number) => {
      const start = new Date()
      start.setUTCDate(start.getUTCDate() + 5)
      start.setUTCHours(8 + ordinal, 0, 0, 0)
      const end = new Date(start.getTime() + 60 * 60 * 1000)
      const data: Record<string, unknown> = {
        tenant: tenantId,
        eventType,
        date: start.toISOString().split('T')[0],
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        lockOutTime: 0,
        active: true,
      }
      if (branchId != null) data.branch = branchId
      const doc = await payload.create({
        collection: 'timeslots',
        data,
        overrideAccess: true,
      })
      return doc.id as number
    }

    timeslotBranchA = await mkSlot(0, locA.id, tenantT.id, eventTypeT)
    timeslotBranchB = await mkSlot(1, locB.id, tenantT.id, eventTypeT)
    timeslotOtherTenant = await mkSlot(2, locOther.id, tenantOther.id, eventTypeOther)
  }, HOOK_TIMEOUT)

  afterAll(async () => {
    if (!payload) return
    try {
      await payload.delete({
        collection: 'timeslots',
        where: {
          id: { in: [timeslotBranchA, timeslotBranchB, timeslotOtherTenant] },
        },
        overrideAccess: true,
      })
      await payload.delete({
        collection: 'event-types',
        where: { id: { in: [eventTypeT, eventTypeOther] } },
        overrideAccess: true,
      })
      await payload.delete({
        collection: 'locations',
        where: { id: { in: [locA.id, locB.id, locOther.id] } },
        overrideAccess: true,
      })
      await payload.delete({
        collection: 'users',
        where: { id: { in: [orgAdmin.id, bootstrapSuperAdminId] } },
        overrideAccess: true,
      })
      await payload.delete({
        collection: 'tenants',
        where: { id: { in: [tenantT.id, tenantOther.id] } },
        overrideAccess: true,
      })
    } catch {
      // ignore
    }
    await payload.db?.destroy?.()
  })

  it(
    'scopes list to branch A when payload-tenant and payload-location match branch A',
    async () => {
      const req = adminReqWithCookies(payload, orgAdmin, {
        'payload-tenant': String(tenantT.id),
        [PAYLOAD_LOCATION_COOKIE]: String(locA.id),
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
    'lists all branches for the tenant when payload-location cookie is absent',
    async () => {
      const req = adminReqWithCookies(payload, orgAdmin, {
        'payload-tenant': String(tenantT.id),
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
      expect(ids).toContain(timeslotBranchB)
      expect(ids).not.toContain(timeslotOtherTenant)
    },
    TEST_TIMEOUT,
  )

  it(
    'does not leak other-tenant timeslots when payload-location is tampered to another tenant branch',
    async () => {
      const req = adminReqWithCookies(payload, orgAdmin, {
        'payload-tenant': String(tenantT.id),
        [PAYLOAD_LOCATION_COOKIE]: String(locOther.id),
      })

      let result: Awaited<ReturnType<typeof payload.find>> | null = null
      let caught: unknown
      try {
        result = await payload.find({
          collection: 'timeslots',
          where: {},
          limit: 100,
          req: req as any,
          overrideAccess: false,
        })
      } catch (e) {
        caught = e
      }

      if (result) {
        const ids = result.docs.map((d) => d.id)
        expect(ids).not.toContain(timeslotOtherTenant)
      } else {
        expect(caught).toBeTruthy()
      }
    },
    TEST_TIMEOUT,
  )

  it(
    'scopes list to branch A when payload-location is set but payload-tenant is missing',
    async () => {
      const req = adminReqWithCookies(payload, orgAdmin, {
        [PAYLOAD_LOCATION_COOKIE]: String(locA.id),
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
      expect(ids).not.toContain(timeslotOtherTenant)
    },
    TEST_TIMEOUT,
  )
})
