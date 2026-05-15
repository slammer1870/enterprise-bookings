/**
 * Phase 7 Chunk 9 — `timeslots.getByDate`: optional `branchId`, `branch-slug` cookie, single-branch auto.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import { createTRPCContext, appRouter } from '@repo/trpc'
import { ATND_ME_BOOKINGS_COLLECTION_SLUGS } from '@/constants/bookings-collection-slugs'
import type { Tenant, EventType } from '@repo/shared-types'
import { PUBLIC_BRANCH_SLUG_COOKIE } from '@/utilities/tenantRequest'

const HOOK_TIMEOUT = 300000
const TEST_TIMEOUT = 60000

describe('timeslots.getByDate branch filter', () => {
  let payload: Payload
  let tenant: Tenant
  let locA: { id: number; slug: string }
  let locB: { id: number; slug: string }
  let singleTenant: Tenant
  let singleLoc: { id: number }
  let eventType: EventType
  let tsA: number
  let tsB: number
  let tsSingleNull: number

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })
    const ts = Date.now()

    tenant = (await payload.create({
      collection: 'tenants',
      data: { name: 'Branch filter tenant', slug: `br-flt-${ts}` },
      overrideAccess: true,
    })) as Tenant

    locA = await payload.create({
      collection: 'locations',
      data: { tenant: tenant.id, name: 'North', slug: `north-${ts}` },
      overrideAccess: true,
    })

    locB = await payload.create({
      collection: 'locations',
      data: { tenant: tenant.id, name: 'South', slug: `south-${ts}` },
      overrideAccess: true,
    })

    singleTenant = (await payload.create({
      collection: 'tenants',
      data: { name: 'Single branch tenant', slug: `br-one-${ts}` },
      overrideAccess: true,
    })) as Tenant

    singleLoc = await payload.create({
      collection: 'locations',
      data: { tenant: singleTenant.id, name: 'Only site', slug: 'main' },
      overrideAccess: true,
    })

    eventType = (await payload.create({
      collection: 'event-types',
      data: {
        name: `Branch filter class ${ts}`,
        places: 8,
        description: 'Test',
        tenant: tenant.id,
      },
      overrideAccess: true,
    })) as EventType

    const etSingle = await payload.create({
      collection: 'event-types',
      data: {
        name: `Single branch class ${ts}`,
        places: 6,
        description: 'Test',
        tenant: singleTenant.id,
      },
      overrideAccess: true,
    })

    const start = new Date()
    start.setUTCDate(start.getUTCDate() + 4)
    start.setUTCHours(14, 0, 0, 0)
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    const dayIso = start.toISOString()

    const docA = await payload.create({
      collection: 'timeslots',
      data: {
        tenant: tenant.id,
        branch: locA.id,
        eventType: eventType.id,
        date: dayIso.split('T')[0],
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        lockOutTime: 0,
        active: true,
      },
      overrideAccess: true,
    })
    tsA = docA.id as number

    const startB = new Date(start.getTime() + 2 * 60 * 60 * 1000)
    const endB = new Date(startB.getTime() + 60 * 60 * 1000)
    const docB = await payload.create({
      collection: 'timeslots',
      data: {
        tenant: tenant.id,
        branch: locB.id,
        eventType: eventType.id,
        date: startB.toISOString().split('T')[0],
        startTime: startB.toISOString(),
        endTime: endB.toISOString(),
        lockOutTime: 0,
        active: true,
      },
      overrideAccess: true,
    })
    tsB = docB.id as number

    const startS = new Date()
    startS.setUTCDate(startS.getUTCDate() + 4)
    startS.setUTCHours(16, 0, 0, 0)
    const endS = new Date(startS.getTime() + 60 * 60 * 1000)
    const docS = await payload.create({
      collection: 'timeslots',
      data: {
        tenant: singleTenant.id,
        branch: null,
        eventType: etSingle.id,
        date: startS.toISOString().split('T')[0],
        startTime: startS.toISOString(),
        endTime: endS.toISOString(),
        lockOutTime: 0,
        active: true,
      },
      overrideAccess: true,
    })
    tsSingleNull = docS.id as number
  }, HOOK_TIMEOUT)

  afterAll(async () => {
    if (!payload) return
    try {
      await payload.delete({
        collection: 'timeslots',
        where: { id: { in: [tsA, tsB, tsSingleNull] } },
        overrideAccess: true,
      })
      await payload.delete({
        collection: 'event-types',
        where: { tenant: { in: [tenant.id, singleTenant.id] } },
        overrideAccess: true,
      })
      await payload.delete({
        collection: 'locations',
        where: { id: { in: [locA.id, locB.id, singleLoc.id] } },
        overrideAccess: true,
      })
      await payload.delete({
        collection: 'tenants',
        where: { id: { in: [tenant.id, singleTenant.id] } },
        overrideAccess: true,
      })
    } catch {
      // ignore
    }
    await payload.db?.destroy?.()
  })

  async function callerWithCookie(cookie: string) {
    const headers = new Headers()
    headers.set('cookie', `tenant-slug=${tenant.slug}; ${cookie}`)
    const ctx = await createTRPCContext({
      headers,
      payload,
      bookingsCollectionSlugs: ATND_ME_BOOKINGS_COLLECTION_SLUGS,
    })
    return appRouter.createCaller(ctx)
  }

  it(
    'filters by explicit branchId',
    async () => {
      const headers = new Headers()
      headers.set('cookie', `tenant-slug=${tenant.slug}`)
      const ctx = await createTRPCContext({
        headers,
        payload,
        bookingsCollectionSlugs: ATND_ME_BOOKINGS_COLLECTION_SLUGS,
      })
      const caller = appRouter.createCaller(ctx)

      const docA = await payload.findByID({
        collection: 'timeslots',
        id: tsA,
        depth: 0,
        overrideAccess: true,
      })
      const day = typeof docA?.startTime === 'string' ? docA.startTime : new Date().toISOString()

      const onlyA = await caller.timeslots.getByDate({
        date: day,
        branchId: locA.id,
      })
      const idsA = onlyA.map((t) => t.id)
      expect(idsA).toContain(tsA)
      expect(idsA).not.toContain(tsB)
    },
    TEST_TIMEOUT,
  )

  it(
    'filters by branch-slug cookie when multiple branches exist',
    async () => {
      const caller = await callerWithCookie(`${PUBLIC_BRANCH_SLUG_COOKIE}=${locB.slug}`)
      const docB = await payload.findByID({
        collection: 'timeslots',
        id: tsB,
        depth: 0,
        overrideAccess: true,
      })
      const day = typeof docB?.startTime === 'string' ? docB.startTime : new Date().toISOString()

      const rows = await caller.timeslots.getByDate({ date: day })
      const ids = rows.map((t) => t.id)
      expect(ids).toContain(tsB)
      expect(ids).not.toContain(tsA)
    },
    TEST_TIMEOUT,
  )

  it(
    'single active location auto-includes branch-null legacy timeslots',
    async () => {
      const headers = new Headers()
      headers.set('cookie', `tenant-slug=${singleTenant.slug}`)
      const ctx = await createTRPCContext({
        headers,
        payload,
        bookingsCollectionSlugs: ATND_ME_BOOKINGS_COLLECTION_SLUGS,
      })
      const caller = appRouter.createCaller(ctx)

      const doc = await payload.findByID({
        collection: 'timeslots',
        id: tsSingleNull,
        depth: 0,
        overrideAccess: true,
      })
      const day = typeof doc?.startTime === 'string' ? doc.startTime : new Date().toISOString()

      const rows = await caller.timeslots.getByDate({ date: day })
      const ids = rows.map((t) => t.id)
      expect(ids).toContain(tsSingleNull)
    },
    TEST_TIMEOUT,
  )

  it(
    'with multiple branches and no cookie or branchId, returns all branches for the day',
    async () => {
      const headers = new Headers()
      headers.set('cookie', `tenant-slug=${tenant.slug}`)
      const ctx = await createTRPCContext({
        headers,
        payload,
        bookingsCollectionSlugs: ATND_ME_BOOKINGS_COLLECTION_SLUGS,
      })
      const caller = appRouter.createCaller(ctx)

      const docA = await payload.findByID({
        collection: 'timeslots',
        id: tsA,
        depth: 0,
        overrideAccess: true,
      })
      const docB = await payload.findByID({
        collection: 'timeslots',
        id: tsB,
        depth: 0,
        overrideAccess: true,
      })
      const dayA = typeof docA?.startTime === 'string' ? docA.startTime : ''
      const dayB = typeof docB?.startTime === 'string' ? docB.startTime : ''
      const rowsA = await caller.timeslots.getByDate({ date: dayA })
      const rowsB = await caller.timeslots.getByDate({ date: dayB })
      const ids = [...rowsA, ...rowsB].map((t) => t.id)
      expect(ids).toContain(tsA)
      expect(ids).toContain(tsB)
    },
    TEST_TIMEOUT,
  )

  it(
    'rejects invalid branchId for tenant',
    async () => {
      const headers = new Headers()
      headers.set('cookie', `tenant-slug=${tenant.slug}`)
      const ctx = await createTRPCContext({
        headers,
        payload,
        bookingsCollectionSlugs: ATND_ME_BOOKINGS_COLLECTION_SLUGS,
      })
      const caller = appRouter.createCaller(ctx)

      try {
        await caller.timeslots.getByDate({
          date: new Date().toISOString(),
          branchId: 999999999,
        })
        expect.fail('expected BAD_REQUEST')
      } catch (e: unknown) {
        expect(e).toHaveProperty('code', 'BAD_REQUEST')
      }
    },
    TEST_TIMEOUT,
  )
})
