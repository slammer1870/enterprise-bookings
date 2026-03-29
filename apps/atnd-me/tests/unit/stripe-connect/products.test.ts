/**
 * Phase 4.5 – Unit tests for stripe-connect/products.ts (create/update/archive product and price on Connect).
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  createTenantProduct,
  updateTenantProduct,
  archiveTenantProduct,
  createTenantPrice,
} from '@/lib/stripe-connect/products'

const mockStripe = {
  products: {
    create: vi.fn(),
    update: vi.fn(),
  },
  prices: {
    create: vi.fn(),
  },
}

vi.mock('@/lib/stripe/platform', () => ({
  getPlatformStripe: () => mockStripe,
}))

// Use an accountId that does not trigger the test bypass (isE2e && /^acct_[a-z_]+_\d+$/)
// so the implementation calls getPlatformStripe() and our mock is used.
const MOCK_ACCOUNT_ID = 'acct_prod_xyz'
vi.mock('@/lib/stripe-connect/tenantStripe', () => ({
  requireTenantConnectAccount: vi.fn(),
  getTenantStripeContext: vi.fn(() => ({ accountId: MOCK_ACCOUNT_ID })),
}))

const tenant = {
  id: 1,
  stripeConnectAccountId: 'acct_test_123',
  stripeConnectOnboardingStatus: 'active' as const,
}

describe('stripe-connect/products', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStripe.products.create.mockResolvedValue({
      id: 'prod_123',
      default_price: 'price_123',
    })
    mockStripe.products.update.mockResolvedValue({ id: 'prod_123', active: true })
    mockStripe.prices.create.mockResolvedValue({ id: 'price_new' })
  })

  describe('createTenantProduct', () => {
    it('calls stripe.products.create with stripeAccount and recurring default_price_data', async () => {
      const result = await createTenantProduct({
        tenant,
        name: 'Monthly Plan',
        defaultPriceData: {
          recurring: {
            unit_amount: 1999,
            currency: 'eur',
            interval: 'month',
            interval_count: 1,
          },
        },
      })

      expect(mockStripe.products.create).toHaveBeenCalledWith(
        {
          name: 'Monthly Plan',
          default_price_data: {
            currency: 'eur',
            unit_amount: 1999,
            recurring: { interval: 'month', interval_count: 1 },
          },
        },
        { stripeAccount: MOCK_ACCOUNT_ID },
      )
      expect(result).toEqual({ productId: 'prod_123', priceId: 'price_123' })
    })

    it('calls stripe.products.create with one-time default_price_data for class pass', async () => {
      mockStripe.products.create.mockResolvedValue({
        id: 'prod_cp',
        default_price: 'price_cp',
      })

      const result = await createTenantProduct({
        tenant,
        name: '10-Pack',
        defaultPriceData: {
          oneTime: { unit_amount: 5000, currency: 'eur' },
        },
      })

      expect(mockStripe.products.create).toHaveBeenCalledWith(
        {
          name: '10-Pack',
          default_price_data: {
            currency: 'eur',
            unit_amount: 5000,
          },
        },
        { stripeAccount: MOCK_ACCOUNT_ID },
      )
      expect(result.productId).toBe('prod_cp')
      expect(result.priceId).toBe('price_cp')
    })

    it('passes description and metadata when provided', async () => {
      await createTenantProduct({
        tenant,
        name: 'Pro',
        description: 'Pro plan',
        metadata: { planId: '1' },
        defaultPriceData: {
          recurring: { unit_amount: 2999, currency: 'eur', interval: 'month' },
        },
      })

      expect(mockStripe.products.create).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Pro plan',
          metadata: { planId: '1' },
        }),
        { stripeAccount: MOCK_ACCOUNT_ID },
      )
    })
  })

  describe('updateTenantProduct', () => {
    it('calls stripe.products.update with name and stripeAccount', async () => {
      await updateTenantProduct({
        tenant,
        productId: 'prod_123',
        name: 'Updated Plan',
      })

      expect(mockStripe.products.update).toHaveBeenCalledWith(
        'prod_123',
        { name: 'Updated Plan' },
        { stripeAccount: MOCK_ACCOUNT_ID },
      )
    })

    it('sends description and active when provided', async () => {
      await updateTenantProduct({
        tenant,
        productId: 'prod_123',
        name: 'X',
        description: 'Desc',
        active: false,
      })

      expect(mockStripe.products.update).toHaveBeenCalledWith(
        'prod_123',
        { name: 'X', description: 'Desc', active: false },
        { stripeAccount: MOCK_ACCOUNT_ID },
      )
    })
  })

  describe('archiveTenantProduct', () => {
    it('sets active: false with stripeAccount', async () => {
      await archiveTenantProduct(tenant, 'prod_123')

      expect(mockStripe.products.update).toHaveBeenCalledWith(
        'prod_123',
        { active: false },
        { stripeAccount: MOCK_ACCOUNT_ID },
      )
    })
  })

  describe('createTenantPrice', () => {
    it('creates recurring price and sets as product default', async () => {
      const result = await createTenantPrice({
        tenant,
        productId: 'prod_123',
        unit_amount: 2500,
        currency: 'eur',
        recurring: { interval: 'month', interval_count: 1 },
      })

      expect(mockStripe.prices.create).toHaveBeenCalledWith(
        {
          product: 'prod_123',
          currency: 'eur',
          unit_amount: 2500,
          recurring: { interval: 'month', interval_count: 1 },
        },
        { stripeAccount: MOCK_ACCOUNT_ID },
      )
      expect(mockStripe.products.update).toHaveBeenCalledWith(
        'prod_123',
        { default_price: 'price_new' },
        { stripeAccount: MOCK_ACCOUNT_ID },
      )
      expect(result).toEqual({ priceId: 'price_new' })
    })

    it('creates one-time price when recurring is omitted', async () => {
      await createTenantPrice({
        tenant,
        productId: 'prod_123',
        unit_amount: 5000,
        currency: 'eur',
      })

      expect(mockStripe.prices.create).toHaveBeenCalledWith(
        {
          product: 'prod_123',
          currency: 'eur',
          unit_amount: 5000,
        },
        { stripeAccount: MOCK_ACCOUNT_ID },
      )
      expect(mockStripe.products.update).not.toHaveBeenCalled()
    })
  })
})
