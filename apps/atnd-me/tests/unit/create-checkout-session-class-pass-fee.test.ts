/**
 * Regression tests: class pass Checkout session must compute and forward bookingFeeAmount.
 *
 * Before the fix, mode='payment' + type='class_pass_purchase' never computed a booking fee,
 * so application_fee_amount was missing from the resulting PaymentIntent. The route now retrieves
 * the Stripe price, calls calculateBookingFeeAmount with productType='class-pass', and passes the
 * fee amount (and productType) to createTenantCheckoutSession.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockCreateTenantCheckoutSession,
  mockEnsureStripeCustomerIdForAccount,
  mockRemoveConnectCustomerMappingForAccount,
  mockPricesRetrieve,
  mockCalculateBookingFeeAmount,
  mockGetCurrentUser,
  mockResolveTenantForConnect,
} = vi.hoisted(() => ({
  mockCreateTenantCheckoutSession: vi.fn(),
  mockEnsureStripeCustomerIdForAccount: vi.fn(),
  mockRemoveConnectCustomerMappingForAccount: vi.fn(),
  mockPricesRetrieve: vi.fn(),
  mockCalculateBookingFeeAmount: vi.fn(),
  mockGetCurrentUser: vi.fn(),
  mockResolveTenantForConnect: vi.fn(),
}))

vi.mock('@/lib/stripe-connect/charges', () => ({
  createTenantCheckoutSession: mockCreateTenantCheckoutSession,
}))

vi.mock('@repo/bookings-payments', () => ({
  ensureStripeCustomerIdForAccount: mockEnsureStripeCustomerIdForAccount,
  removeConnectCustomerMappingForAccount: mockRemoveConnectCustomerMappingForAccount,
}))

vi.mock('@/lib/stripe/platform', () => ({
  getPlatformStripe: () => ({
    prices: { retrieve: mockPricesRetrieve },
  }),
}))

vi.mock('@/lib/stripe-connect/bookingFee', async () => {
  const actual = await vi.importActual<typeof import('@/lib/stripe-connect/bookingFee')>(
    '@/lib/stripe-connect/bookingFee',
  )
  return { ...actual, calculateBookingFeeAmount: mockCalculateBookingFeeAmount }
})

vi.mock('@/lib/stripe-connect/api-helpers', () => ({
  getCurrentUser: mockGetCurrentUser,
  resolveTenantSlugOrId: vi.fn().mockReturnValue(null),
  resolveTenantForConnect: mockResolveTenantForConnect,
}))

vi.mock('@/lib/stripe-connect/test-accounts', () => ({
  isStripeTestAccount: vi.fn().mockReturnValue(false),
}))

vi.mock('@/lib/stripe-connect/discountCodes', () => ({
  resolveTenantPromotionCodeId: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/payload', () => ({
  getPayload: vi.fn().mockResolvedValue({}),
}))

import { POST } from '@/app/api/stripe/connect/create-checkout-session/route'
import { NextRequest } from 'next/server'

const ACTIVE_TENANT = {
  id: 42,
  stripeConnectAccountId: 'acct_prod_abc123',
  stripeConnectOnboardingStatus: 'active' as const,
}

const USER = { id: 7, email: 'user@test.com', name: 'Test User' }

function request(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/stripe/connect/create-checkout-session', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-tenant-id': String(ACTIVE_TENANT.id), ...headers },
    body: JSON.stringify(body),
  })
}

describe('create-checkout-session route – class pass fee regression', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('ENABLE_TEST_WEBHOOKS', '')

    mockGetCurrentUser.mockResolvedValue(USER)
    mockResolveTenantForConnect.mockResolvedValue(ACTIVE_TENANT)
    mockEnsureStripeCustomerIdForAccount.mockResolvedValue({ stripeCustomerId: 'cus_test_123' })
    mockPricesRetrieve.mockResolvedValue({ unit_amount: 3000, currency: 'eur', recurring: null })
    mockCalculateBookingFeeAmount.mockResolvedValue(90)
    mockCreateTenantCheckoutSession.mockResolvedValue({ id: 'cs_live_1', url: 'https://checkout.stripe.com/1' })
  })

  it('retrieves Stripe price and computes fee with productType class-pass for class_pass_purchase', async () => {
    const res = await POST(
      request({
        priceId: 'price_class_pass_abc',
        quantity: 1,
        mode: 'payment',
        metadata: { type: 'class_pass_purchase', tenantId: String(ACTIVE_TENANT.id) },
      }),
    )

    expect(res.status).toBe(200)
    expect(mockPricesRetrieve).toHaveBeenCalledWith(
      'price_class_pass_abc',
      { expand: [] },
      expect.objectContaining({ stripeAccount: ACTIVE_TENANT.stripeConnectAccountId }),
    )
    expect(mockCalculateBookingFeeAmount).toHaveBeenCalledWith(
      expect.objectContaining({ productType: 'class-pass', classPriceAmount: 3000 }),
    )
    expect(mockCreateTenantCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ bookingFeeAmount: 90, productType: 'class-pass' }),
    )
  })

  it('multiplies unit_amount by quantity when computing class pass fee', async () => {
    mockPricesRetrieve.mockResolvedValue({ unit_amount: 2500, currency: 'eur', recurring: null })
    mockCalculateBookingFeeAmount.mockResolvedValue(150)

    await POST(
      request({
        priceId: 'price_class_pass_multi',
        quantity: 3,
        mode: 'payment',
        metadata: { type: 'class_pass_purchase', tenantId: String(ACTIVE_TENANT.id) },
      }),
    )

    expect(mockCalculateBookingFeeAmount).toHaveBeenCalledWith(
      expect.objectContaining({ productType: 'class-pass', classPriceAmount: 7500 }),
    )
    expect(mockCreateTenantCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ bookingFeeAmount: 150 }),
    )
  })

  it('does not compute fee and passes productType undefined for payment mode without class_pass_purchase', async () => {
    await POST(
      request({
        priceId: 'price_other',
        quantity: 1,
        mode: 'payment',
        metadata: { type: 'drop_in', tenantId: String(ACTIVE_TENANT.id) },
      }),
    )

    expect(mockPricesRetrieve).not.toHaveBeenCalled()
    expect(mockCalculateBookingFeeAmount).not.toHaveBeenCalled()
    expect(mockCreateTenantCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ bookingFeeAmount: undefined, productType: undefined }),
    )
  })

  it('does not compute class pass fee when price unit_amount is 0', async () => {
    mockPricesRetrieve.mockResolvedValue({ unit_amount: 0, currency: 'eur', recurring: null })

    await POST(
      request({
        priceId: 'price_free_class_pass',
        quantity: 1,
        mode: 'payment',
        metadata: { type: 'class_pass_purchase', tenantId: String(ACTIVE_TENANT.id) },
      }),
    )

    expect(mockPricesRetrieve).toHaveBeenCalledOnce()
    expect(mockCalculateBookingFeeAmount).not.toHaveBeenCalled()
    expect(mockCreateTenantCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ bookingFeeAmount: undefined }),
    )
  })
})
