/**
 * Auth course purchase: create PaymentIntent for course enrollment.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockCreateTenantPaymentIntent,
  mockEnsureStripeCustomerIdForAccount,
  mockPayload,
  mockGetCurrentUser,
  mockResolveTenantSlugOrId,
  mockResolveTenantForConnect,
} = vi.hoisted(() => ({
  mockCreateTenantPaymentIntent: vi.fn(),
  mockEnsureStripeCustomerIdForAccount: vi.fn(),
  mockGetCurrentUser: vi.fn(),
  mockResolveTenantSlugOrId: vi.fn(),
  mockResolveTenantForConnect: vi.fn(),
  mockPayload: {
    findByID: vi.fn(),
    find: vi.fn().mockResolvedValue({ docs: [], totalDocs: 0 }),
  },
}))

vi.mock('@/lib/payload', () => ({
  getPayload: vi.fn().mockResolvedValue(mockPayload),
}))

vi.mock('@/lib/stripe-connect/api-helpers', () => ({
  getCurrentUser: mockGetCurrentUser,
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

import { POST } from '@/app/api/courses/purchase/route'

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/courses/purchase', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as any
}

describe('POST /api/courses/purchase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsStripeTestAccount.mockReturnValue(true)
    mockGetCurrentUser.mockResolvedValue({ id: 7, email: 'a@b.com', name: 'Ada' })
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
      priceInformation: { price: 99 },
      maxEnrollments: null,
    })
    mockPayload.find.mockResolvedValue({ docs: [], totalDocs: 0 })
    mockEnsureStripeCustomerIdForAccount.mockResolvedValue({ stripeCustomerId: 'cus_test' })
    mockCreateTenantPaymentIntent.mockResolvedValue({ client_secret: 'pi_live_secret' })
  })

  it('returns 401 when unauthenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null)
    const res = await POST(makeRequest({ courseId: 4 }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when courseId missing', async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ error: expect.stringMatching(/courseId/i) })
  })

  it('returns clientSecret for open course on test account', async () => {
    const res = await POST(makeRequest({ courseId: 4 }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.clientSecret).toMatch(/_secret_test$/)
    expect(json.stripeAccountId).toBe('acct_placeholder_test')
  })

  it('accepts courseId via CheckoutForm metadata', async () => {
    const res = await POST(makeRequest({ price: 99, metadata: { courseId: '4' } }))
    expect(res.status).toBe(200)
  })

  it('returns 400 when course sold out', async () => {
    mockPayload.findByID.mockResolvedValue({
      id: 4,
      status: 'open',
      tenant: 1,
      priceInformation: { price: 99 },
      maxEnrollments: 1,
    })
    mockPayload.find.mockResolvedValue({ docs: [], totalDocs: 1 })
    const res = await POST(makeRequest({ courseId: 4 }))
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ error: expect.stringMatching(/sold out/i) })
  })

  it('creates PaymentIntent with productType course (not class-pass)', async () => {
    mockIsStripeTestAccount.mockReturnValue(false)
    mockResolveTenantForConnect.mockResolvedValue({
      id: 1,
      stripeConnectAccountId: 'acct_1RealConnectAccount',
      stripeConnectOnboardingStatus: 'active',
    })

    const res = await POST(makeRequest({ courseId: 4 }))
    expect(res.status).toBe(200)
    expect(mockCreateTenantPaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        productType: 'course',
        classPriceAmount: 9900,
        metadata: expect.objectContaining({ type: 'course_purchase', courseId: '4' }),
      }),
    )
  })
})
