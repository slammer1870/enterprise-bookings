/**
 * Trial CTA / bookingStatus must be scoped per tenant:
 * a confirmed booking at tenant A must not consume trial eligibility at tenant B.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import { createTRPCContext, appRouter } from '@repo/trpc'
import { ATND_ME_BOOKINGS_COLLECTION_SLUGS } from '@/constants/bookings-collection-slugs'
import type { Tenant, User } from '@repo/shared-types'

const HOOK_TIMEOUT = 300000
const TEST_TIMEOUT = 60000

describe('trial eligibility tenant scoping', () => {
  let payload: Payload
  let tenantA: Tenant
  let tenantB: Tenant
  let user: User
  let timeslotAId: number
  let timeslotBId: number
  let dayIso: string

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })
    const ts = Date.now()

    tenantA = (await payload.create({
      collection: 'tenants',
      data: { name: 'Trial Scope A', slug: `trial-a-${ts}` },
      overrideAccess: true,
    })) as Tenant

    tenantB = (await payload.create({
      collection: 'tenants',
      data: {
        name: 'Trial Scope B',
        slug: `trial-b-${ts}`,
        stripeConnectOnboardingStatus: 'active',
        stripeConnectAccountId: `acct_trial_scope_b_${ts}`,
      },
      overrideAccess: true,
    })) as Tenant

    user = (await payload.create({
      collection: 'users',
      data: {
        email: `trial-scope-${ts}@test.com`,
        password: 'password',
        name: 'Trial Scope User',
      },
      overrideAccess: true,
    })) as User

    const etA = await payload.create({
      collection: 'event-types',
      data: {
        name: `Trial Scope Class A ${ts}`,
        places: 8,
        description: 'Tenant A class',
        tenant: tenantA.id,
      },
      overrideAccess: true,
    })

    const dropInB = await payload.create({
      collection: 'drop-ins',
      data: {
        name: `Trial Scope Drop-in B ${ts}`,
        isActive: true,
        price: 10,
        adjustable: true,
        discountTiers: [{ minQuantity: 1, discountPercent: 50, type: 'trial' }],
        tenant: tenantB.id,
      },
      overrideAccess: true,
    })

    const etB = await payload.create({
      collection: 'event-types',
      data: {
        name: `Trial Scope Class B ${ts}`,
        places: 8,
        description: 'Tenant B trialable class',
        tenant: tenantB.id,
        paymentMethods: { allowedDropIn: dropInB.id },
      },
      overrideAccess: true,
    })

    const start = new Date()
    start.setUTCDate(start.getUTCDate() + 5)
    start.setUTCHours(14, 0, 0, 0)
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    dayIso = start.toISOString()

    const tsA = await payload.create({
      collection: 'timeslots',
      data: {
        tenant: tenantA.id,
        eventType: etA.id,
        date: dayIso.split('T')[0],
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        lockOutTime: 0,
        active: true,
      },
      overrideAccess: true,
    })
    timeslotAId = tsA.id as number

    const startB = new Date(start.getTime() + 2 * 60 * 60 * 1000)
    const endB = new Date(startB.getTime() + 60 * 60 * 1000)
    const tsB = await payload.create({
      collection: 'timeslots',
      data: {
        tenant: tenantB.id,
        eventType: etB.id,
        date: startB.toISOString().split('T')[0],
        startTime: startB.toISOString(),
        endTime: endB.toISOString(),
        lockOutTime: 0,
        active: true,
      },
      overrideAccess: true,
    })
    timeslotBId = tsB.id as number

    // Confirmed booking only on tenant A — must not block trial on B.
    await payload.create({
      collection: 'bookings',
      data: {
        user: user.id,
        timeslot: timeslotAId,
        tenant: tenantA.id,
        status: 'confirmed',
      },
      overrideAccess: true,
    })
  }, HOOK_TIMEOUT)

  afterAll(async () => {
    if (!payload) return
    try {
      await payload.delete({
        collection: 'bookings',
        where: { user: { equals: user.id } },
        overrideAccess: true,
      })
      await payload.delete({
        collection: 'timeslots',
        where: { id: { in: [timeslotAId, timeslotBId] } },
        overrideAccess: true,
      })
      await payload.delete({
        collection: 'event-types',
        where: { tenant: { in: [tenantA.id, tenantB.id] } },
        overrideAccess: true,
      })
      await payload.delete({
        collection: 'drop-ins',
        where: { tenant: { equals: tenantB.id } },
        overrideAccess: true,
      })
      await payload.delete({
        collection: 'users',
        where: { id: { equals: user.id } },
        overrideAccess: true,
      })
      await payload.delete({
        collection: 'tenants',
        where: { id: { in: [tenantA.id, tenantB.id] } },
        overrideAccess: true,
      })
    } catch {
      // ignore cleanup errors
    }
    await payload.db?.destroy?.()
  })

  async function getByDateForTenantB() {
    const headers = new Headers()
    headers.set('cookie', `tenant-slug=${tenantB.slug}`)
    const ctx = await createTRPCContext({
      headers,
      payload,
      user,
      bookingsCollectionSlugs: ATND_ME_BOOKINGS_COLLECTION_SLUGS,
    })
    const caller = appRouter.createCaller(ctx)
    return caller.timeslots.getByDate({
      date: dayIso,
      tenantId: tenantB.id as number,
    })
  }

  it(
    'still offers Book Trial Class on tenant B when user only booked on tenant A',
    async () => {
      const rows = await getByDateForTenantB()
      const row = rows.find((r) => r.id === timeslotBId)
      expect(row).toBeTruthy()
      expect(row?.scheduleState?.label).toBe('Book Trial Class')
      expect(row?.bookingStatus).toBe('trialable')
    },
    TEST_TIMEOUT,
  )

  it(
    'stops offering trial on tenant B after a confirmed booking there',
    async () => {
      await payload.create({
        collection: 'bookings',
        data: {
          user: user.id,
          timeslot: timeslotBId,
          tenant: tenantB.id,
          status: 'confirmed',
        },
        overrideAccess: true,
      })

      const rows = await getByDateForTenantB()
      const row = rows.find((r) => r.id === timeslotBId)
      expect(row).toBeTruthy()
      // Already booked this timeslot → cancel/modify path, not trial.
      expect(row?.scheduleState?.label).not.toBe('Book Trial Class')
      expect(row?.bookingStatus).not.toBe('trialable')
    },
    TEST_TIMEOUT,
  )
})
