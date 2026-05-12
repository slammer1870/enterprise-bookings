/**
 * Phase 7 Chunk 3 — timeslots `branch` → `locations` (tenant-scoped); text `location` = room/area.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import type { User, Tenant } from '@repo/shared-types'

const HOOK_TIMEOUT = 300000
const TEST_TIMEOUT = 60000

describe('Timeslots branch field (→ locations)', () => {
  let payload: Payload
  let superAdmin: User
  let tenantT: Tenant
  let tenantOther: Tenant
  let branchA: { id: number }
  let branchB: { id: number }
  let branchOtherTenant: { id: number }
  let eventTypeId: number
  const timeslotIds: number[] = []

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })
    const ts = Date.now()

    tenantT = (await payload.create({
      collection: 'tenants',
      data: { name: 'Branch Test Tenant', slug: `branch-tslot-t-${ts}` },
      overrideAccess: true,
    })) as Tenant

    tenantOther = (await payload.create({
      collection: 'tenants',
      data: { name: 'Other Tenant', slug: `branch-tslot-o-${ts}` },
      overrideAccess: true,
    })) as Tenant

    superAdmin = (await payload.create({
      collection: 'users',
      data: {
        name: 'Super',
        email: `super-tslot-branch-${ts}@test.com`,
        password: 'test',
        role: ['super-admin'],
        emailVerified: true,
      },
      draft: false,
      overrideAccess: true,
    } as Parameters<typeof payload.create>[0])) as User

    branchA = await payload.create({
      collection: 'locations',
      data: { tenant: tenantT.id, name: 'Site A', slug: `site-a-${ts}` },
      overrideAccess: true,
    })

    branchB = await payload.create({
      collection: 'locations',
      data: { tenant: tenantT.id, name: 'Site B', slug: `site-b-${ts}` },
      overrideAccess: true,
    })

    branchOtherTenant = await payload.create({
      collection: 'locations',
      data: { tenant: tenantOther.id, name: 'Other site', slug: `other-site-${ts}` },
      overrideAccess: true,
    })

    const et = await payload.create({
      collection: 'event-types',
      data: {
        name: `Branch test class ${ts}`,
        places: 8,
        description: 'Test',
        tenant: tenantT.id,
      },
      overrideAccess: true,
    })
    eventTypeId = et.id as number
  }, HOOK_TIMEOUT)

  afterAll(async () => {
    if (!payload) return
    try {
      if (timeslotIds.length > 0) {
        await payload.delete({
          collection: 'timeslots',
          where: { id: { in: timeslotIds } },
          overrideAccess: true,
        })
      }
      await payload.delete({
        collection: 'event-types',
        where: { id: { equals: eventTypeId } },
        overrideAccess: true,
      })
      await payload.delete({
        collection: 'locations',
        where: {
          id: {
            in: [branchA.id, branchB.id, branchOtherTenant.id],
          },
        },
        overrideAccess: true,
      })
      await payload.delete({
        collection: 'users',
        where: { id: { equals: superAdmin.id } },
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

  function baseTimeslotData(ordinal: number) {
    const start = new Date()
    start.setUTCDate(start.getUTCDate() + 3)
    start.setUTCHours(10 + ordinal, 0, 0, 0)
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    return {
      tenant: tenantT.id,
      eventType: eventTypeId,
      date: start.toISOString().split('T')[0],
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      lockOutTime: 0,
      active: true,
    }
  }

  it(
    'creates a timeslot with branch + room/area text (location)',
    async () => {
      const doc = await payload.create({
        collection: 'timeslots',
        data: {
          ...baseTimeslotData(0),
          branch: branchA.id,
          location: 'Sauna 1',
        },
        user: superAdmin,
        overrideAccess: false,
      })
      timeslotIds.push(doc.id as number)

      const bid = typeof doc.branch === 'object' && doc.branch ? (doc.branch as { id: number }).id : doc.branch
      expect(bid).toBe(branchA.id)
      expect(doc.location).toBe('Sauna 1')
    },
    TEST_TIMEOUT,
  )

  it(
    'rejects a timeslot whose branch belongs to another tenant',
    async () => {
      await expect(
        payload.create({
          collection: 'timeslots',
          data: {
            ...baseTimeslotData(1),
            branch: branchOtherTenant.id,
          },
          user: superAdmin,
          overrideAccess: false,
        }),
      ).rejects.toThrow(/same tenant/i)
    },
    TEST_TIMEOUT,
  )

  it(
    'creates a timeslot without branch (optional)',
    async () => {
      const doc = await payload.create({
        collection: 'timeslots',
        data: baseTimeslotData(2),
        user: superAdmin,
        overrideAccess: false,
      })
      timeslotIds.push(doc.id as number)
      const bid = typeof doc.branch === 'object' && doc.branch ? (doc.branch as { id: number }).id : doc.branch
      expect(bid == null).toBe(true)
    },
    TEST_TIMEOUT,
  )

  it(
    'allows the second branch on the same tenant in a separate timeslot',
    async () => {
      const doc = await payload.create({
        collection: 'timeslots',
        data: {
          ...baseTimeslotData(3),
          branch: branchB.id,
          location: 'Studio 2',
        },
        user: superAdmin,
        overrideAccess: false,
      })
      timeslotIds.push(doc.id as number)
      const bid = typeof doc.branch === 'object' && doc.branch ? (doc.branch as { id: number }).id : doc.branch
      expect(bid).toBe(branchB.id)
    },
    TEST_TIMEOUT,
  )
})
