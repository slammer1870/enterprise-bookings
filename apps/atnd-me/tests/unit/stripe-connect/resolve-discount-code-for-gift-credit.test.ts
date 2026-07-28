import { describe, expect, it } from 'vitest'

import {
  extractStripePromotionCodeId,
  extractStripePromotionCodeIdFromLegacyDiscount,
  resolveDiscountCodeForGiftCredit,
} from '@/lib/stripe-connect/resolveDiscountCodeForGiftCredit'

describe('extractStripePromotionCodeId', () => {
  it('reads string promotion_code from Checkout discounts array', () => {
    expect(
      extractStripePromotionCodeId([{ coupon: null, promotion_code: 'promo_abc' }]),
    ).toBe('promo_abc')
  })

  it('reads expanded promotion_code object', () => {
    expect(
      extractStripePromotionCodeId([{ promotion_code: { id: 'promo_obj' } }]),
    ).toBe('promo_obj')
  })

  it('returns null for empty/invalid', () => {
    expect(extractStripePromotionCodeId(undefined)).toBeNull()
    expect(extractStripePromotionCodeId([])).toBeNull()
    expect(extractStripePromotionCodeId([{ coupon: 'x' }])).toBeNull()
  })
})

describe('extractStripePromotionCodeIdFromLegacyDiscount', () => {
  it('reads singular discount.promotion_code', () => {
    expect(
      extractStripePromotionCodeIdFromLegacyDiscount({
        promotion_code: 'promo_legacy',
      }),
    ).toBe('promo_legacy')
  })
})

describe('resolveDiscountCodeForGiftCredit', () => {
  it('prefers metadata.discountCode over Stripe promo lookup', async () => {
    const payload = {
      find: async () => {
        throw new Error('should not look up')
      },
    }
    const code = await resolveDiscountCodeForGiftCredit({
      payload: payload as never,
      tenantId: 11,
      metadataDiscountCode: 'CLASS',
      stripePromotionCodeId: 'promo_should_ignore',
    })
    expect(code).toBe('CLASS')
  })

  it('resolves human code from stripePromotionCodeId when metadata missing', async () => {
    const payload = {
      find: async () => ({
        docs: [{ id: 1, code: 'class150', stripePromotionCodeId: 'promo_x' }],
      }),
    }
    const code = await resolveDiscountCodeForGiftCredit({
      payload: payload as never,
      tenantId: 11,
      metadataDiscountCode: undefined,
      stripePromotionCodeId: 'promo_x',
    })
    expect(code).toBe('CLASS150')
  })

  it('returns null when neither metadata nor promo resolves', async () => {
    const payload = {
      find: async () => ({ docs: [] }),
    }
    const code = await resolveDiscountCodeForGiftCredit({
      payload: payload as never,
      tenantId: 11,
      metadataDiscountCode: '',
      stripePromotionCodeId: 'promo_missing',
    })
    expect(code).toBeNull()
  })
})
