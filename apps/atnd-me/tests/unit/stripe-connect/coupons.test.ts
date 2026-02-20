/**
 * Phase 4.5 – Unit tests for stripe-connect/coupons.ts.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  createTenantCouponAndPromoCode,
  deactivateTenantPromotionCode,
} from '@/lib/stripe-connect/coupons'

const mockStripe = {
  coupons: { create: vi.fn() },
  promotionCodes: { create: vi.fn(), update: vi.fn() },
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

describe('stripe-connect/coupons', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStripe.coupons.create.mockResolvedValue({ id: 'coupon_123' })
    mockStripe.promotionCodes.create.mockResolvedValue({ id: 'promo_123' })
    mockStripe.promotionCodes.update.mockResolvedValue({ id: 'promo_123', active: false })
  })

  describe('createTenantCouponAndPromoCode', () => {
    it('creates coupon with percent_off and duration then promotion code with stripeAccount', async () => {
      const result = await createTenantCouponAndPromoCode({
        tenant,
        code: 'SUMMER20',
        percent_off: 20,
        duration: 'forever',
      })

      expect(mockStripe.coupons.create).toHaveBeenCalledWith(
        { percent_off: 20, duration: 'forever' },
        { stripeAccount: MOCK_ACCOUNT_ID },
      )
      expect(mockStripe.promotionCodes.create).toHaveBeenCalledWith(
        { coupon: 'coupon_123', code: 'SUMMER20' },
        { stripeAccount: MOCK_ACCOUNT_ID },
      )
      expect(result).toEqual({ couponId: 'coupon_123', promotionCodeId: 'promo_123' })
    })

    it('creates coupon with amount_off and currency', async () => {
      await createTenantCouponAndPromoCode({
        tenant,
        code: 'OFF5',
        amount_off: 500,
        currency: 'eur',
        duration: 'once',
      })

      expect(mockStripe.coupons.create).toHaveBeenCalledWith(
        { amount_off: 500, currency: 'eur', duration: 'once' },
        { stripeAccount: MOCK_ACCOUNT_ID },
      )
    })

    it('passes duration_in_months for repeating, max_redemptions, redeem_by', async () => {
      await createTenantCouponAndPromoCode({
        tenant,
        code: 'REPEAT',
        percent_off: 10,
        duration: 'repeating',
        duration_in_months: 3,
        max_redemptions: 100,
        redeem_by: 1234567890,
      })

      expect(mockStripe.coupons.create).toHaveBeenCalledWith(
        {
          percent_off: 10,
          duration: 'repeating',
          duration_in_months: 3,
          max_redemptions: 100,
          redeem_by: 1234567890,
        },
        { stripeAccount: MOCK_ACCOUNT_ID },
      )
    })

    it('throws when neither percent_off nor amount_off', async () => {
      await expect(
        createTenantCouponAndPromoCode({
          tenant,
          code: 'X',
          duration: 'once',
        }),
      ).rejects.toThrow('Either percent_off or amount_off is required')
      expect(mockStripe.coupons.create).not.toHaveBeenCalled()
    })

    it('throws when amount_off without currency', async () => {
      await expect(
        createTenantCouponAndPromoCode({
          tenant,
          code: 'X',
          amount_off: 500,
          duration: 'once',
        }),
      ).rejects.toThrow('currency is required when amount_off is set')
    })
  })

  describe('deactivateTenantPromotionCode', () => {
    it('updates promotion code active to false with stripeAccount', async () => {
      await deactivateTenantPromotionCode(tenant, 'promo_123')

      expect(mockStripe.promotionCodes.update).toHaveBeenCalledWith(
        'promo_123',
        { active: false },
        { stripeAccount: MOCK_ACCOUNT_ID },
      )
    })
  })
})
