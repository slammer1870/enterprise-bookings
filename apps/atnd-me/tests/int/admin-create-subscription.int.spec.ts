import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { getPayload, type Payload } from 'payload'

vi.mock('../../src/lib/stripe/platform', () => ({
  getPlatformStripe: vi.fn(),
}))

vi.mock('@repo/bookings-payments', async () => {
  const actual = await vi.importActual<typeof import('@repo/bookings-payments')>('@repo/bookings-payments')
  return {
    ...actual,
    ensureStripeCustomerIdForAccount: vi.fn(),
  }
})

import config from '../../src/payload.config'
import { createSubscriptionInStripeEndpoint } from '../../src/endpoints/admin/stripe/create-subscription'
import { updateStripeSubscriptionEndpoint } from '../../src/endpoints/admin/stripe/update-subscription'
import { getPlatformStripe } from '../../src/lib/stripe/platform'
import { ensureStripeCustomerIdForAccount } from '@repo/bookings-payments'

const HOOK_TIMEOUT = 300000
const TEST_TIMEOUT = 60000
const runId = Math.random().toString(36).slice(2, 10)

describe('admin create Stripe subscription endpoint', () => {
  let payload: Payload
  let adminUserId: number
  let userId: number
  let tenantId: number
  let planId: number
  let subscriptionId: number
  const createSubscriptionMock = vi.fn()
  const updateSubscriptionMock = vi.fn()
  const cancelSubscriptionMock = vi.fn()

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    const admin = await payload.create({
      collection: 'users',
      data: {
        name: 'Admin Create Subscription',
        email: `admin-create-sub-${Date.now()}@test.com`,
        password: 'test',
        role: ['super-admin'],
        emailVerified: true,
      },
      draft: false,
      overrideAccess: true,
    } as Parameters<typeof payload.create>[0])
    adminUserId = admin.id as number

    const tenant = await payload.create({
      collection: 'tenants',
      data: {
        name: 'Endpoint Tenant',
        slug: `endpoint-tenant-${Date.now()}`,
        stripeConnectAccountId: `acct_admin_sub_${runId}`,
        stripeConnectOnboardingStatus: 'active',
      },
      overrideAccess: true,
    })
    tenantId = tenant.id as number

    const user = await payload.create({
      collection: 'users',
      data: {
        name: 'Subscription User',
        email: `subscription-user-${Date.now()}@test.com`,
        password: 'test',
        role: ['user'],
        emailVerified: true,
      },
      draft: false,
      overrideAccess: true,
    } as Parameters<typeof payload.create>[0])
    userId = user.id as number

    const plan = await payload.create({
      collection: 'plans',
      data: {
        name: 'Endpoint Plan',
        status: 'active',
        tenant: tenantId,
        stripeProductId: `prod_admin_sub_${runId}`,
        priceJSON: JSON.stringify({ id: `price_admin_sub_${runId}` }),
      },
      overrideAccess: true,
      context: { skipStripeSync: true },
    })
    planId = plan.id as number

    const subscription = await payload.create({
      collection: 'subscriptions' as import('payload').CollectionSlug,
      data: {
        tenant: tenantId,
        user: user.id,
        plan: planId,
        status: 'incomplete',
      } as Record<string, unknown>,
      overrideAccess: true,
      context: { skipStripeSync: true },
    })
    subscriptionId = subscription.id as number
  }, HOOK_TIMEOUT)

  beforeEach(() => {
    vi.mocked(ensureStripeCustomerIdForAccount).mockReset()
    vi.mocked(getPlatformStripe).mockReset()

    vi.mocked(ensureStripeCustomerIdForAccount).mockResolvedValue({
      stripeCustomerId: `cus_admin_sub_${runId}`,
      stripeAccountId: `acct_admin_sub_${runId}`,
    })

    createSubscriptionMock.mockReset()
    updateSubscriptionMock.mockReset()
    cancelSubscriptionMock.mockReset()
    createSubscriptionMock.mockResolvedValue({
      id: `sub_admin_created_${runId}`,
      status: 'active',
      current_period_start: 1_700_000_000,
      current_period_end: 1_702_592_000,
      cancel_at: null,
    })
    updateSubscriptionMock.mockResolvedValue({
      id: `sub_admin_created_${runId}`,
      status: 'active',
      current_period_start: 1_700_000_000,
      current_period_end: 1_702_592_000,
      cancel_at: 1_702_592_000,
      canceled_at: null,
    })
    cancelSubscriptionMock.mockResolvedValue({
      id: `sub_admin_created_${runId}`,
      status: 'canceled',
      current_period_start: 1_700_000_000,
      current_period_end: 1_702_592_000,
      cancel_at: null,
      canceled_at: 1_700_086_400,
    })

    vi.mocked(getPlatformStripe).mockReturnValue({
      subscriptions: {
        create: createSubscriptionMock,
        update: updateSubscriptionMock,
        cancel: cancelSubscriptionMock,
      },
    } as never)
  })

  afterAll(async () => {
    if (payload?.db) {
      try {
        await payload.delete({
          collection: 'subscriptions' as import('payload').CollectionSlug,
          id: subscriptionId,
          overrideAccess: true,
          context: { skipStripeSync: true },
        })
        await payload.delete({
          collection: 'plans',
          id: planId,
          overrideAccess: true,
          context: { skipStripeSync: true },
        })
        await payload.delete({
          collection: 'tenants',
          where: { id: { equals: tenantId } },
          overrideAccess: true,
        })
        await payload.delete({
          collection: 'users',
          where: { id: { in: [adminUserId, userId] } },
          overrideAccess: true,
        })
      } catch {
        // ignore cleanup failures
      }
      await payload.db?.destroy?.()
    }
  })

  it(
    'creates the Stripe subscription and updates the local document',
    async () => {
      const adminUser = await payload.findByID({
        collection: 'users',
        id: adminUserId,
        depth: 0,
        overrideAccess: true,
      })

      const response = await createSubscriptionInStripeEndpoint.handler({
        payload,
        user: adminUser,
        routeParams: { id: String(subscriptionId) },
      } as Parameters<typeof createSubscriptionInStripeEndpoint.handler>[0])

      expect(response.status).toBe(200)
      const body = (await response.json()) as { ok: boolean; stripeSubscriptionId: string; status: string }
      expect(body.ok).toBe(true)
      expect(body.stripeSubscriptionId).toBe(`sub_admin_created_${runId}`)
      expect(body.status).toBe('active')

      expect(ensureStripeCustomerIdForAccount).toHaveBeenCalledWith(
        expect.objectContaining({
          payload,
          stripeAccountId: `acct_admin_sub_${runId}`,
        }),
      )
      expect(createSubscriptionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: `cus_admin_sub_${runId}`,
          items: [{ price: `price_admin_sub_${runId}` }],
          metadata: { tenantId: String(tenantId) },
        }),
        { stripeAccount: `acct_admin_sub_${runId}` },
      )

      const updated = await payload.findByID({
        collection: 'subscriptions' as import('payload').CollectionSlug,
        id: subscriptionId,
        depth: 0,
        overrideAccess: true,
      })

      expect(updated.stripeSubscriptionId).toBe(`sub_admin_created_${runId}`)
      expect(updated.status).toBe('active')
      expect(updated.stripeAccountId).toBe(`acct_admin_sub_${runId}`)
      expect(updated.stripeCustomerId).toBe(`cus_admin_sub_${runId}`)
      expect(updated.startDate).toBe('2023-11-14T00:00:00.000Z')
      expect(updated.endDate).toBe('2023-12-14T00:00:00.000Z')
      expect(updated.cancelAt).toBeNull()
    },
    TEST_TIMEOUT,
  )

  it(
    'schedules cancellation in Stripe and syncs the local cancel date',
    async () => {
      await payload.update({
        collection: 'subscriptions' as import('payload').CollectionSlug,
        id: subscriptionId,
        data: {
          stripeSubscriptionId: `sub_admin_created_${runId}`,
          stripeAccountId: `acct_admin_sub_${runId}`,
          stripeCustomerId: `cus_admin_sub_${runId}`,
          status: 'active',
          cancelAt: null,
        } as Record<string, unknown>,
        overrideAccess: true,
        context: { skipStripeSync: true, tenant: tenantId },
      })

      const adminUser = await payload.findByID({
        collection: 'users',
        id: adminUserId,
        depth: 0,
        overrideAccess: true,
      })

      const req = new Request('http://localhost/api/admin/stripe/subscriptions/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel_at_period_end' }),
      })

      const response = await updateStripeSubscriptionEndpoint.handler({
        payload,
        user: adminUser,
        routeParams: { id: String(subscriptionId) },
        json: async () => ({ action: 'cancel_at_period_end' }),
        request: req,
      } as Parameters<typeof updateStripeSubscriptionEndpoint.handler>[0])

      expect(response.status).toBe(200)
      expect(updateSubscriptionMock).toHaveBeenCalledWith(
        `sub_admin_created_${runId}`,
        { cancel_at_period_end: true },
        { stripeAccount: `acct_admin_sub_${runId}` },
      )

      const updated = await payload.findByID({
        collection: 'subscriptions' as import('payload').CollectionSlug,
        id: subscriptionId,
        depth: 0,
        overrideAccess: true,
      })

      expect(updated.status).toBe('active')
      expect(updated.cancelAt).toBe('2023-12-14T00:00:00.000Z')
    },
    TEST_TIMEOUT,
  )

  it(
    'cancels the subscription immediately in Stripe and syncs the local status',
    async () => {
      await payload.update({
        collection: 'subscriptions' as import('payload').CollectionSlug,
        id: subscriptionId,
        data: {
          stripeSubscriptionId: `sub_admin_created_${runId}`,
          stripeAccountId: `acct_admin_sub_${runId}`,
          stripeCustomerId: `cus_admin_sub_${runId}`,
          status: 'active',
          cancelAt: null,
        } as Record<string, unknown>,
        overrideAccess: true,
        context: { skipStripeSync: true, tenant: tenantId },
      })

      const adminUser = await payload.findByID({
        collection: 'users',
        id: adminUserId,
        depth: 0,
        overrideAccess: true,
      })

      const req = new Request('http://localhost/api/admin/stripe/subscriptions/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel_now' }),
      })

      const response = await updateStripeSubscriptionEndpoint.handler({
        payload,
        user: adminUser,
        routeParams: { id: String(subscriptionId) },
        json: async () => ({ action: 'cancel_now' }),
        request: req,
      } as Parameters<typeof updateStripeSubscriptionEndpoint.handler>[0])

      expect(response.status).toBe(200)
      expect(cancelSubscriptionMock).toHaveBeenCalledWith(
        `sub_admin_created_${runId}`,
        {},
        { stripeAccount: `acct_admin_sub_${runId}` },
      )

      const updated = await payload.findByID({
        collection: 'subscriptions' as import('payload').CollectionSlug,
        id: subscriptionId,
        depth: 0,
        overrideAccess: true,
      })

      expect(updated.status).toBe('canceled')
      expect(updated.cancelAt).toBe('2023-11-15T00:00:00.000Z')
    },
    TEST_TIMEOUT,
  )
})
