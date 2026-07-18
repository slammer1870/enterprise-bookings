import { describe, expect, it, vi } from 'vitest'
import {
  resolveTenantDiscountCode,
  resolveTenantPromotionCodeId,
  validateTenantDiscountCode,
} from '@/lib/stripe-connect/discountCodes'

function makePayload(docs: Array<Record<string, unknown>>) {
  return {
    find: vi.fn().mockResolvedValue({ docs, totalDocs: docs.length }),
  }
}

describe('resolveTenantDiscountCode (migrated skipSync codes)', () => {
  it('resolves active amount_off codes without Stripe promotion ids', async () => {
    const payload = makePayload([
      {
        code: '30416106',
        type: 'amount_off',
        value: 55,
        currency: 'eur',
        stripePromotionCodeId: null,
        skipSync: true,
      },
    ])

    const discount = await resolveTenantDiscountCode(payload as never, 7, '30416106')
    expect(discount).toEqual({
      code: '30416106',
      type: 'amount_off',
      value: 55,
      currency: 'eur',
      stripePromotionCodeId: null,
    })
    expect(await validateTenantDiscountCode(payload as never, 7, '30416106')).toBe(true)
    expect(await resolveTenantPromotionCodeId(payload as never, 7, '30416106')).toBeUndefined()
  })

  it('rejects inactive codes even when present', async () => {
    const payload = makePayload([])
    expect(await resolveTenantDiscountCode(payload as never, 7, 'USEDUP01')).toBeUndefined()
    expect(await validateTenantDiscountCode(payload as never, 7, 'USEDUP01')).toBe(false)
  })

  it('matches codes case-insensitively among active docs', async () => {
    const payload = makePayload([
      {
        code: 'gift55',
        type: 'amount_off',
        value: 55,
        currency: 'eur',
      },
    ])

    const discount = await resolveTenantDiscountCode(payload as never, 7, 'GIFT55')
    expect(discount?.code).toBe('GIFT55')
    expect(discount?.value).toBe(55)
  })
})
