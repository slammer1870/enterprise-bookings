/**
 * Phase 7 Chunk 12 — Scheduler scoped per location.
 *
 * Tests:
 *  1. Branch is required on Scheduler create when tenant has multiple active locations.
 *  2. Branch is NOT required when tenant has only one active location.
 *  3. Scheduler list read access is filtered by `payload-location` cookie.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import type { EventType, User } from '@repo/shared-types'

const HOOK_TIMEOUT = 300000
const TEST_TIMEOUT = 60_000

describe('Scheduler — branch scoping', () => {
  let payload: Payload
  let tenantId: number
  let branchAId: number
  let branchBId: number
  let eventTypeId: number
  let tenantAdmin: User

  const createdSchedulerIds: number[] = []
  // Extra resources created in-test (solo-tenant test) cleaned up in afterAll
  const extraCleanup: Array<() => Promise<void>> = []

  const startDate = new Date()
  startDate.setDate(startDate.getDate() + 7)
  startDate.setHours(0, 0, 0, 0)
  const endDate = new Date(startDate)
  endDate.setDate(endDate.getDate() + 14)

  function baseSchedulerData(overrides: Record<string, unknown> = {}) {
    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      lockOutTime: 0,
      defaultEventType: eventTypeId,
      clearExisting: false,
      week: {
        days: Array.from({ length: 7 }, () => ({ timeSlot: [] })),
      },
      ...overrides,
    }
  }

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    const ts = Date.now()

    const tenant = await payload.create({
      collection: 'tenants',
      data: { name: `Sched Scope Tenant ${ts}`, slug: `sched-scope-${ts}` },
      overrideAccess: true,
    })
    tenantId = Number((tenant as { id: number }).id)

    const locA = await payload.create({
      collection: 'locations',
      data: { name: 'Branch A', slug: `sched-a-${ts}`, tenant: tenantId, active: true },
      overrideAccess: true,
    })
    branchAId = Number((locA as { id: number }).id)

    const locB = await payload.create({
      collection: 'locations',
      data: { name: 'Branch B', slug: `sched-b-${ts}`, tenant: tenantId, active: true },
      overrideAccess: true,
    })
    branchBId = Number((locB as { id: number }).id)

    const et = (await payload.create({
      collection: 'event-types',
      data: { name: `Sched ET ${ts}`, places: 8, description: 'Sched scope test', tenant: tenantId },
      overrideAccess: true,
    })) as EventType
    eventTypeId = Number(et.id)

    tenantAdmin = (await payload.create({
      collection: 'users',
      data: {
        name: 'Sched Admin',
        email: `sched-admin-${ts}@test.com`,
        password: 'test',
        role: ['admin'],
        emailVerified: true,
        tenants: [{ tenant: tenantId, roles: ['admin'] }],
      },
      overrideAccess: true,
    } as Parameters<typeof payload.create>[0])) as User
  }, HOOK_TIMEOUT)

  afterAll(async () => {
    if (!payload) return
    try {
      // Run any extra cleanup registered by individual tests
      for (const fn of extraCleanup) {
        try { await fn() } catch { /* ignore */ }
      }
      if (createdSchedulerIds.length > 0) {
        await payload.delete({
          collection: 'scheduler',
          where: { id: { in: createdSchedulerIds } },
          overrideAccess: true,
        })
      }
      await payload.delete({
        collection: 'users',
        where: { id: { equals: tenantAdmin?.id } },
        overrideAccess: true,
      })
      await payload.delete({
        collection: 'event-types',
        where: { id: { equals: eventTypeId } },
        overrideAccess: true,
      })
      await payload.delete({
        collection: 'locations',
        where: { id: { in: [branchAId, branchBId] } },
        overrideAccess: true,
      })
      await payload.delete({
        collection: 'tenants',
        where: { id: { equals: tenantId } },
        overrideAccess: true,
      })
    } catch {
      // ignore cleanup errors
    }
    await payload.db?.destroy?.()
  })

  // ── Branch required validation ───────────────────────────────────────────

  it(
    'rejects scheduler create without branch when tenant has multiple active locations',
    async () => {
      await expect(
        payload.create({
          collection: 'scheduler',
          data: { ...baseSchedulerData(), tenant: tenantId },
          overrideAccess: true,
        }),
      ).rejects.toThrow(/more than one active site/i)
    },
    TEST_TIMEOUT,
  )

  it(
    'creates scheduler with branch when tenant has multiple active locations',
    async () => {
      const doc = await payload.create({
        collection: 'scheduler',
        data: { ...baseSchedulerData(), tenant: tenantId, branch: branchAId },
        overrideAccess: true,
      })
      createdSchedulerIds.push(doc.id as number)
      const bid =
        typeof doc.branch === 'object' && doc.branch
          ? (doc.branch as { id: number }).id
          : doc.branch
      expect(bid).toBe(branchAId)
    },
    TEST_TIMEOUT,
  )

  it(
    'allows scheduler create without branch when tenant has only one active location',
    async () => {
      const ts = Date.now()
      const soloTenant = await payload.create({
        collection: 'tenants',
        data: { name: `Solo Sched Tenant ${ts}`, slug: `solo-sched-${ts}` },
        overrideAccess: true,
      })
      const soloTenantId = Number((soloTenant as { id: number }).id)

      const soloLoc = await payload.create({
        collection: 'locations',
        data: { name: 'Only Site', slug: `only-sched-${ts}`, tenant: soloTenantId, active: true },
        overrideAccess: true,
      })
      const soloLocId = Number((soloLoc as { id: number }).id)

      const soloEt = await payload.create({
        collection: 'event-types',
        data: { name: `Solo Sched ET ${ts}`, places: 5, description: 'solo', tenant: soloTenantId },
        overrideAccess: true,
      })
      const soloEtId = Number((soloEt as { id: number }).id)

      // Register cleanup to run in afterAll (avoids inline DB calls that can fail if a
      // prior test aborted a postgres transaction on the same connection).
      extraCleanup.push(async () => {
        await payload.delete({ collection: 'locations', where: { id: { equals: soloLocId } }, overrideAccess: true })
        await payload.delete({ collection: 'event-types', where: { id: { equals: soloEtId } }, overrideAccess: true })
        await payload.delete({ collection: 'tenants', where: { id: { equals: soloTenantId } }, overrideAccess: true })
      })

      const doc = await payload.create({
        collection: 'scheduler',
        data: {
          ...baseSchedulerData({ defaultEventType: soloEtId }),
          tenant: soloTenantId,
          // no branch — should be accepted for a single-location tenant
        },
        overrideAccess: true,
      })
      createdSchedulerIds.push(doc.id as number)
      expect(doc.id).toBeTruthy()
    },
    TEST_TIMEOUT,
  )

  // ── Read access filtered by payload-location ─────────────────────────────

  it(
    'tenant admin with payload-location cookie sees only the matching branch scheduler',
    async () => {
      // Create a second scheduler for branchB
      const docB = await payload.create({
        collection: 'scheduler',
        data: {
          ...baseSchedulerData({
            startDate: new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            endDate: new Date(endDate.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          }),
          tenant: tenantId,
          branch: branchBId,
        },
        overrideAccess: true,
      })
      createdSchedulerIds.push(docB.id as number)

      // Simulate the tenant admin making a request with payload-location = branchAId
      const mockReq = {
        user: tenantAdmin,
        payload,
        context: {},
        cookies: {
          get: (name: string) => {
            if (name === 'payload-tenant') return { value: String(tenantId) }
            if (name === 'payload-location') return { value: String(branchAId) }
            return undefined
          },
        },
        headers: {
          get: (_name: string) => null,
        },
      }

      const result = await payload.find({
        collection: 'scheduler',
        where: { tenant: { equals: tenantId } },
        overrideAccess: false,
        user: tenantAdmin,
        req: mockReq as Parameters<typeof payload.find>[0]['req'],
      })

      const branchIds = result.docs.map((d) =>
        typeof d.branch === 'object' && d.branch ? (d.branch as { id: number }).id : d.branch,
      )

      // Only branchA schedulers should be visible when payload-location=branchAId
      expect(branchIds.every((bid) => bid === branchAId)).toBe(true)
      expect(branchIds.some((bid) => bid === branchBId)).toBe(false)
    },
    TEST_TIMEOUT,
  )

  it(
    'tenant admin without payload-location cookie sees all schedulers for the tenant',
    async () => {
      const mockReq = {
        user: tenantAdmin,
        payload,
        context: {},
        cookies: {
          get: (name: string) => {
            if (name === 'payload-tenant') return { value: String(tenantId) }
            // no payload-location
            return undefined
          },
        },
        headers: {
          get: (_name: string) => null,
        },
      }

      const result = await payload.find({
        collection: 'scheduler',
        where: { tenant: { equals: tenantId } },
        overrideAccess: false,
        user: tenantAdmin,
        req: mockReq as Parameters<typeof payload.find>[0]['req'],
      })

      const branchIds = result.docs.map((d) =>
        typeof d.branch === 'object' && d.branch ? (d.branch as { id: number }).id : d.branch,
      )

      // Both branches should appear when no location filter is active
      expect(branchIds.some((bid) => bid === branchAId)).toBe(true)
      expect(branchIds.some((bid) => bid === branchBId)).toBe(true)
    },
    TEST_TIMEOUT,
  )
})
