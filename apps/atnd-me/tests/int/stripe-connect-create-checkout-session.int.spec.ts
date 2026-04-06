/**
 * Phase 2.5 – Stripe Checkout session route
 * Tests POST /api/stripe/connect/create-checkout-session.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import type { User } from '@repo/shared-types'
import { NextRequest } from 'next/server'
const { mockCreateTenantCheckoutSession, mockEnsureStripeCustomerIdForAccount } = vi.hoisted(() => ({
  mockCreateTenantCheckoutSession: vi.fn(),
  mockEnsureStripeCustomerIdForAccount: vi.fn(),
}))

vi.mock('@/lib/stripe-connect/charges', () => ({
  createTenantCheckoutSession: mockCreateTenantCheckoutSession,
}))

vi.mock('@repo/bookings-payments', async () => {
  const actual = await vi.importActual<typeof import('@repo/bookings-payments')>('@repo/bookings-payments')
  return {
    ...actual,
    ensureStripeCustomerIdForAccount: mockEnsureStripeCustomerIdForAccount,
  }
})

import { POST } from '@/app/api/stripe/connect/create-checkout-session/route'

const TEST_TIMEOUT = 60000
const HOOK_TIMEOUT = 300000
const runId = Math.random().toString(36).slice(2, 10)
const connectedAccount = `acct_e2e_connected_checkout_${runId}`
const disconnectedAccount = `acct_disconnected_checkout_${runId}`

type RequestOptions = {
  headers?: Record<string, string>
  url?: string
  body?: Record<string, unknown> | null
  rawBody?: string
}

describe('create-checkout-session API route (Phase 2.5)', () => {
  let payload: Payload
  let regularUser: User
  let activeTenantId: number
  let inactiveTenantId: number

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    regularUser = (await payload.create({
      collection: 'users',
      data: {
        name: 'Checkout Route User',
        email: `checkout-route-user-${runId}@test.com`,
        password: 'test',
        roles: ['user'],
        emailVerified: true,
      },
      draft: false,
      overrideAccess: true,
    } as Parameters<typeof payload.create>[0])) as User

    const activeTenant = await payload.create({
      collection: 'tenants',
      data: {
        name: 'Checkout Tenant Active',
        slug: `checkout-tenant-active-${runId}`,
        stripeConnectAccountId: connectedAccount,
        stripeConnectOnboardingStatus: 'active',
      },
      overrideAccess: true,
    })
    activeTenantId = activeTenant.id as number

    const inactiveTenant = await payload.create({
      collection: 'tenants',
      data: {
        name: 'Checkout Tenant Inactive',
        slug: `checkout-tenant-inactive-${runId}`,
        stripeConnectAccountId: disconnectedAccount,
        stripeConnectOnboardingStatus: 'not_connected',
      },
      overrideAccess: true,
    })
    inactiveTenantId = inactiveTenant.id as number
  }, HOOK_TIMEOUT)

  afterAll(async () => {
    if (payload) {
      try {
        await payload.delete({
          collection: 'users',
          where: { id: { in: [regularUser.id] } },
        })
        await payload.delete({
          collection: 'tenants',
          where: { id: { in: [activeTenantId, inactiveTenantId] } },
        })
      } catch {
        // ignore cleanup failures
      }
      await payload.db?.destroy?.()
    }
  })

  beforeEach(() => {
    mockCreateTenantCheckoutSession.mockReset()
    mockEnsureStripeCustomerIdForAccount.mockReset()
    mockCreateTenantCheckoutSession.mockResolvedValue({
      id: 'cs_test_123',
      url: 'https://checkout.test/session',
    })
    mockEnsureStripeCustomerIdForAccount.mockResolvedValue({
      stripeCustomerId: 'cus_test_123',
      stripeAccountId: connectedAccount,
    })
  })

  function request(opts: RequestOptions = {}) {
    const url = opts.url ?? 'http://localhost:3000/api/stripe/connect/create-checkout-session'
    const headers = new Headers(opts.headers ?? {})
    const hasExplicitContentType = opts.headers?.['content-type']
    if (!hasExplicitContentType) {
      headers.set('content-type', 'application/json')
    }
    const body =
      typeof opts.rawBody === 'string'
        ? opts.rawBody
        : opts.body === undefined
          ? undefined
          : JSON.stringify(opts.body)

    return new NextRequest(url, {
      method: 'POST',
      headers,
      body,
    })
  }

  it(
    'rejects when no authenticated user',
    async () => {
      const res = await POST(
        request({
          headers: { 'x-tenant-id': String(activeTenantId) },
          body: { priceId: 'price_1' },
        }),
      )
      expect(res.status).toBe(401)
      expect(mockCreateTenantCheckoutSession).not.toHaveBeenCalled()
      expect(mockEnsureStripeCustomerIdForAccount).not.toHaveBeenCalled()
    },
    TEST_TIMEOUT,
  )

  it(
    'rejects malformed JSON bodies',
    async () => {
      const res = await POST(
        request({
          headers: { 'x-test-user-id': String(regularUser.id), 'x-tenant-id': String(activeTenantId) },
          rawBody: 'not-json',
        }),
      )
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body).toMatchObject({ error: 'Invalid JSON body' })
      expect(mockCreateTenantCheckoutSession).not.toHaveBeenCalled()
    },
    TEST_TIMEOUT,
  )

  it(
    'rejects missing tenant context',
    async () => {
      const res = await POST(request({ headers: { 'x-test-user-id': String(regularUser.id) }, body: { priceId: 'price_1' } }))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body).toMatchObject({
        error:
          'Tenant context required (x-tenant-slug / x-tenant-id / tenant-slug cookie / metadata.tenantId)',
      })
      expect(mockCreateTenantCheckoutSession).not.toHaveBeenCalled()
    },
    TEST_TIMEOUT,
  )

  it(
    'rejects when tenant is not stripe-connected',
    async () => {
      const res = await POST(
        request({
          headers: { 'x-test-user-id': String(regularUser.id), 'x-tenant-id': String(inactiveTenantId) },
          body: { priceId: 'price_1' },
        }),
      )
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body).toMatchObject({ error: 'Tenant is not connected to Stripe' })
      expect(mockCreateTenantCheckoutSession).not.toHaveBeenCalled()
      expect(mockEnsureStripeCustomerIdForAccount).not.toHaveBeenCalled()
    },
    TEST_TIMEOUT,
  )

  it(
    'creates checkout session for active tenant and forwards checkout payload',
    async () => {
      const res = await POST(
        request({
          headers: { 'x-test-user-id': String(regularUser.id), 'x-tenant-id': String(activeTenantId) },
          body: {
            priceId: 'price_sub_1',
            quantity: 2,
            mode: 'subscription',
            metadata: { source: 'integration' },
          },
        }),
      )

      expect(res.status).toBe(200)
      const payloadRes = (await res.json()) as { id: string; url: string }
      expect(payloadRes).toEqual({ id: 'cs_test_123', url: 'https://checkout.test/session' })
      expect(mockEnsureStripeCustomerIdForAccount).toHaveBeenCalledTimes(1)
      expect(mockCreateTenantCheckoutSession).toHaveBeenCalledTimes(1)

      const createCall = mockCreateTenantCheckoutSession.mock.calls[0]?.[0]
      const { payload: checkoutPayload, ...createCallWithoutPayload } = createCall ?? {}
      expect(createCallWithoutPayload).toMatchObject({
        tenant: {
          id: activeTenantId,
          stripeConnectAccountId: connectedAccount,
          stripeConnectOnboardingStatus: 'active',
        },
        price: 'price_sub_1',
        mode: 'subscription',
        quantity: 2,
        successUrl: 'http://localhost:3000/',
        cancelUrl: 'http://localhost:3000/',
      })
      expect(checkoutPayload).toBe(payload)
      expect(createCallWithoutPayload.metadata).toMatchObject({
        source: 'integration',
        tenantId: String(activeTenantId),
      })
      expect(mockCreateTenantCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({ customerId: 'cus_test_123' }),
      )
    },
    TEST_TIMEOUT,
  )

  it(
    'resolves tenant from numeric metadata.tenantId outside test-only header flow',
    async () => {
      const res = await POST(
        request({
          headers: { 'x-test-user-id': String(regularUser.id) },
          body: {
            priceId: 'price_sub_1',
            quantity: 1,
            mode: 'payment',
            metadata: { tenantId: String(activeTenantId), type: 'class_pass_purchase' },
          },
        }),
      )

      expect(res.status).toBe(200)
      const payloadRes = (await res.json()) as { id: string; url: string }
      expect(payloadRes).toEqual({ id: 'cs_test_123', url: 'https://checkout.test/session' })
      expect(mockEnsureStripeCustomerIdForAccount).toHaveBeenCalledTimes(1)
      expect(mockCreateTenantCheckoutSession).toHaveBeenCalledTimes(1)
      expect(mockCreateTenantCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant: expect.objectContaining({ id: activeTenantId }),
          metadata: expect.objectContaining({
            tenantId: String(activeTenantId),
            type: 'class_pass_purchase',
            userId: String(regularUser.id),
          }),
        }),
      )
    },
    TEST_TIMEOUT,
  )
})
