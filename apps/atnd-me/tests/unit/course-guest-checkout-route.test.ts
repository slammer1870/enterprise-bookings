/**
 * Guest course checkout: ensureGuestUser + PaymentIntent for course enrollment.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockEnsureGuestUser,
  mockCreateTenantPaymentIntent,
  mockEnsureStripeCustomerIdForAccount,
  mockPayload,
  mockResolveTenantSlugOrId,
  mockResolveTenantForConnect,
  mockCheckRateLimit,
} = vi.hoisted(() => ({
  mockEnsureGuestUser: vi.fn(),
  mockCreateTenantPaymentIntent: vi.fn(),
  mockEnsureStripeCustomerIdForAccount: vi.fn(),
  mockResolveTenantSlugOrId: vi.fn(),
  mockResolveTenantForConnect: vi.fn(),
  mockCheckRateLimit: vi.fn().mockReturnValue({ allowed: true, retryAfterMs: 0 }),
  mockPayload: {
    findByID: vi.fn(),
    find: vi.fn().mockResolvedValue({ docs: [], totalDocs: 0 }),
  },
}))

vi.mock('@/lib/booking/ensureGuestUser', () => ({
  ensureGuestUser: mockEnsureGuestUser,
}))

vi.mock('@/lib/payload', () => ({
  getPayload: vi.fn().mockResolvedValue(mockPayload),
}))

vi.mock('@/lib/stripe-connect/api-helpers', () => ({
  resolveTenantSlugOrId: mockResolveTenantSlugOrId,
  resolveTenantForConnect: mockResolveTenantForConnect,
}))

const mockIsStripeTestAccount = vi.hoisted(() => vi.fn().mockReturnValue(true))

vi.mock('@/lib/stripe-connect/test-accounts', () => ({
  isStripeTestAccount: mockIsStripeTestAccount,
}))

vi.mock('@/lib/stripe-connect/charges', () => ({
  createTenantPaymentIntent: mockCreateTenantPaymentIntent,
}))

vi.mock('@repo/bookings-payments', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@repo/bookings-payments')>()
  return {
    ...actual,
    ensureStripeCustomerIdForAccount: mockEnsureStripeCustomerIdForAccount,
  }
})

vi.mock('@/lib/onboarding/rateLimit', () => ({
  checkRateLimit: mockCheckRateLimit,
}))

import { NextRequest } from 'next/server'

import { POST } from '@/app/api/courses/guest-checkout/route'

function makeRequest(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/courses/guest-checkout', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': '1.2.3.4',
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/courses/guest-checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsStripeTestAccount.mockReturnValue(true)
    mockCheckRateLimit.mockReturnValue({ allowed: true, retryAfterMs: 0 })
    mockResolveTenantSlugOrId.mockReturnValue('acme')
    mockResolveTenantForConnect.mockResolvedValue({
      id: 1,
      stripeConnectAccountId: 'acct_placeholder_test',
      stripeConnectOnboardingStatus: 'active',
    })
    mockPayload.findByID.mockResolvedValue({
      id: 4,
      status: 'open',
      tenant: 1,
      priceInformation: { price: 80 },
    })
    mockPayload.find.mockResolvedValue({ docs: [], totalDocs: 0 })
    mockEnsureGuestUser.mockResolvedValue({
      userId: 77,
      created: true,
      email: 'guest@example.com',
      name: 'Sam Guest',
    })
    mockEnsureStripeCustomerIdForAccount.mockResolvedValue({ stripeCustomerId: 'cus_guest' })
    mockCreateTenantPaymentIntent.mockResolvedValue({ client_secret: 'pi_live_secret' })
  })

  it('rejects incomplete guest email', async () => {
    const res = await POST(
      makeRequest({ courseId: 4, guestName: 'Sam', guestEmail: 'sam@ex' }),
    )
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({
      error: expect.stringMatching(/valid email/i),
    })
    expect(mockEnsureGuestUser).not.toHaveBeenCalled()
  })

  it('rejects short guest name', async () => {
    const res = await POST(
      makeRequest({ courseId: 4, guestName: 'S', guestEmail: 'sam@example.com' }),
    )
    expect(res.status).toBe(400)
  })

  it('returns clientSecret for guest on test account', async () => {
    const res = await POST(
      makeRequest({ courseId: 4, guestName: 'Sam Guest', guestEmail: 'sam@example.com' }),
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.clientSecret).toMatch(/_secret_test$/)
    expect(mockEnsureGuestUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'sam@example.com',
        name: 'Sam Guest',
        tenantId: 1,
      }),
    )
  })

  it('accepts guest fields via CheckoutForm metadata', async () => {
    const res = await POST(
      makeRequest({
        price: 80,
        metadata: {
          courseId: '4',
          guestName: 'Sam Guest',
          guestEmail: 'sam@example.com',
        },
      }),
    )
    expect(res.status).toBe(200)
  })

  it('rate limits by email', async () => {
    mockCheckRateLimit.mockImplementation(({ key }: { key: string }) => {
      if (key.includes('email:')) return { allowed: false, retryAfterMs: 1000 }
      return { allowed: true, retryAfterMs: 0 }
    })
    const res = await POST(
      makeRequest({ courseId: 4, guestName: 'Sam Guest', guestEmail: 'sam@example.com' }),
    )
    expect(res.status).toBe(429)
  })

  it('stamps the public branch cookie on the guest PaymentIntent and ignores a client branch', async () => {
    mockIsStripeTestAccount.mockReturnValue(false)
    mockResolveTenantForConnect.mockResolvedValue({
      id: 1,
      stripeConnectAccountId: 'acct_1RealConnectAccount',
      stripeConnectOnboardingStatus: 'active',
    })
    mockPayload.find.mockImplementation(({ collection }: { collection: string }) => {
      if (collection === 'locations') {
        return Promise.resolve({
          docs: [{ id: 12, name: 'Rathmines', slug: 'rathmines', tenant: 1 }],
          totalDocs: 1,
        })
      }
      return Promise.resolve({ docs: [], totalDocs: 0 })
    })

    const res = await POST(
      makeRequest(
        {
          courseId: 4,
          guestName: 'Sam Guest',
          guestEmail: 'sam@example.com',
          metadata: { branchName: 'Client Branch', branchSlug: 'client-branch' },
        },
        { cookie: 'branch-slug=rathmines' },
      ),
    )

    expect(res.status).toBe(200)
    expect(mockCreateTenantPaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          branchName: 'Rathmines',
          branchSlug: 'rathmines',
        }),
      }),
    )
  })

  it('creates PaymentIntent with productType course (not class-pass)', async () => {
    mockIsStripeTestAccount.mockReturnValue(false)
    mockResolveTenantForConnect.mockResolvedValue({
      id: 1,
      stripeConnectAccountId: 'acct_1RealConnectAccount',
      stripeConnectOnboardingStatus: 'active',
    })

    const res = await POST(
      makeRequest({ courseId: 4, guestName: 'Sam Guest', guestEmail: 'sam@example.com' }),
    )
    expect(res.status).toBe(200)
    expect(mockCreateTenantPaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        productType: 'course',
        metadata: expect.objectContaining({
          type: 'course_purchase',
          guestCheckout: 'true',
          courseId: '4',
        }),
      }),
    )
  })
})
