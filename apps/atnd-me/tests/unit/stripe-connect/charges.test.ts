/**
 * Phase 2.7 – Unit tests for connect checkout session creation helper.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TenantNotConnectedError } from '@/lib/stripe-connect/tenantStripe'
import { createTenantCheckoutSession } from '@/lib/stripe-connect/charges'

const mockCheckoutSessionCreate = vi.fn()
const mockPricesRetrieve = vi.fn()

vi.mock('@/lib/stripe/platform', () => ({
  getPlatformStripe: () => ({
    checkout: {
      sessions: {
        create: mockCheckoutSessionCreate,
      },
    },
    prices: {
      retrieve: mockPricesRetrieve,
    },
  }),
}))

const connectedTenant = {
  id: 101,
  stripeConnectAccountId: 'acct_prod_xyz',
  stripeConnectOnboardingStatus: 'active' as const,
}

const disconnectedTenant = {
  id: 102,
  stripeConnectAccountId: 'acct_disconnected_xyz',
  stripeConnectOnboardingStatus: 'not_connected' as const,
}

describe('createTenantCheckoutSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckoutSessionCreate.mockResolvedValue({
      id: 'cs_live_123',
      url: 'https://checkout.example/session',
    })
    mockPricesRetrieve.mockResolvedValue({
      unit_amount: 1000,
      currency: 'eur',
      recurring: {
        interval: 'month',
        interval_count: 1,
      },
    })
  })

  it('creates a checkout session on the tenant connected account and sets fee line items for subscriptions', async () => {
    const result = await createTenantCheckoutSession({
      tenant: connectedTenant,
      price: 'price_123',
      mode: 'subscription',
      quantity: 2,
      bookingFeeAmount: 150,
      customerId: 'cus_123',
      metadata: {
        tenantId: '101',
        bookingId: 'bk_1',
      },
      subscriptionApplicationFeePercent: 4,
      disableTestShortCircuit: true,
    })

    expect(result).toEqual({
      id: 'cs_live_123',
      url: 'https://checkout.example/session',
    })
    expect(mockCheckoutSessionCreate).toHaveBeenCalledTimes(1)
    expect(mockPricesRetrieve).toHaveBeenCalledTimes(1)
    const [createArgs, sessionOptions] = mockCheckoutSessionCreate.mock.calls[0] ?? []
    expect(sessionOptions).toEqual({
      stripeAccount: 'acct_prod_xyz',
    })
    expect(createArgs).toMatchObject({
      mode: 'subscription',
      customer: 'cus_123',
      line_items: [
        { price: 'price_123', quantity: 2 },
        {
          quantity: 1,
          price_data: {
            currency: 'eur',
            unit_amount: 150,
            recurring: {
              interval: 'month',
              interval_count: 1,
            },
          },
        },
      ],
      subscription_data: {
        application_fee_percent: 4,
        metadata: {
          tenantId: '101',
          bookingId: 'bk_1',
          classPriceAmount: '2000',
          bookingFeeAmount: '150',
        },
      },
      metadata: {
        tenantId: '101',
        bookingId: 'bk_1',
        classPriceAmount: '2000',
        bookingFeeAmount: '150',
      },
    })
  })

  it('creates a payment checkout session when no booking fee is configured', async () => {
    await createTenantCheckoutSession({
      tenant: connectedTenant,
      price: 'price_456',
      mode: 'payment',
      quantity: 3,
      metadata: { bookingId: 'bk_2' },
      disableTestShortCircuit: true,
    })

    expect(mockPricesRetrieve).not.toHaveBeenCalled()
    expect(mockCheckoutSessionCreate).toHaveBeenCalledTimes(1)
    const [createArgs, sessionOptions] = mockCheckoutSessionCreate.mock.calls[0] ?? []
    expect(createArgs).toMatchObject({
      mode: 'payment',
      line_items: [{ price: 'price_456', quantity: 3 }],
      metadata: {
        tenantId: '101',
        bookingId: 'bk_2',
      },
    })
    expect(createArgs).not.toHaveProperty('subscription_data')
    expect(sessionOptions).toEqual({ stripeAccount: 'acct_prod_xyz' })
  })

  it('adds Stripe discounts when a promotion code id is provided', async () => {
    await createTenantCheckoutSession({
      tenant: connectedTenant,
      price: 'price_discounted',
      mode: 'payment',
      quantity: 1,
      metadata: { bookingId: 'bk_discount' },
      customerId: 'cus_discount',
      promotionCodeId: 'promo_123',
      disableTestShortCircuit: true,
    })

    expect(mockCheckoutSessionCreate).toHaveBeenCalledTimes(1)
    const [createArgs, sessionOptions] = mockCheckoutSessionCreate.mock.calls[0] ?? []
    expect(createArgs).toMatchObject({
      mode: 'payment',
      customer: 'cus_discount',
      line_items: [{ price: 'price_discounted', quantity: 1 }],
      discounts: [{ promotion_code: 'promo_123' }],
      metadata: {
        tenantId: '101',
        bookingId: 'bk_discount',
      },
    })
    expect(sessionOptions).toEqual({ stripeAccount: 'acct_prod_xyz' })
  })

  it('short-circuits session creation in test-like environments', async () => {
    const result = await createTenantCheckoutSession({
      tenant: connectedTenant,
      price: 'price_789',
      mode: 'payment',
      metadata: { bookingId: 'bk_3' },
    })

    expect(result.id).toMatch(/^cs_test_/)
    expect(mockCheckoutSessionCreate).not.toHaveBeenCalled()
    expect(mockPricesRetrieve).not.toHaveBeenCalled()
  })

  it('returns mock session for Stripe test accounts even when short-circuiting is disabled', async () => {
    const testTenant = {
      id: 103,
      stripeConnectAccountId: 'acct_e2e_connected_checkout_abc',
      stripeConnectOnboardingStatus: 'active' as const,
    }

    const result = await createTenantCheckoutSession({
      tenant: testTenant,
      price: 'price_999',
      mode: 'payment',
      metadata: { bookingId: 'bk_4' },
      disableTestShortCircuit: true,
    })

    expect(result.id).toMatch(/^cs_test_/)
    expect(mockCheckoutSessionCreate).not.toHaveBeenCalled()
  })

  it('throws TenantNotConnectedError when tenant is not connected', async () => {
    await expect(
      createTenantCheckoutSession({
        tenant: disconnectedTenant,
        price: 'price_000',
        mode: 'payment',
        metadata: { bookingId: 'bk_5' },
        disableTestShortCircuit: true,
      }),
    ).rejects.toThrow(TenantNotConnectedError)

    expect(mockCheckoutSessionCreate).not.toHaveBeenCalled()
  })
})
