import { describe, expect, it, vi } from 'vitest'
import {
  checkTenantDiscountCode,
  consumeDiscountCodeRedemption,
  isDiscountCodeExhausted,
  resolveTenantDiscountCode,
  resolveTenantPromotionCodeId,
  validateTenantDiscountCode,
} from '@/lib/stripe-connect/discountCodes'

function makePayload(docs: Array<Record<string, unknown>>) {
  return {
    find: vi.fn().mockResolvedValue({ docs, totalDocs: docs.length }),
    update: vi.fn().mockImplementation(async ({ id, data }) => {
      const doc = docs.find((d) => d.id === id)
      if (doc) Object.assign(doc, data)
      return { id, ...doc, ...data }
    }),
    db: {},
  }
}

describe('resolveTenantDiscountCode (migrated skipSync codes)', () => {
  it('resolves active amount_off codes without Stripe promotion ids', async () => {
    const payload = makePayload([
      {
        id: 1,
        code: '30416106',
        type: 'amount_off',
        value: 55,
        currency: 'eur',
        stripePromotionCodeId: null,
        skipSync: true,
        status: 'active',
        timesRedeemed: 0,
        maxRedemptions: 1,
      },
    ])

    const discount = await resolveTenantDiscountCode(payload as never, 7, '30416106')
    expect(discount).toEqual({
      id: 1,
      code: '30416106',
      type: 'amount_off',
      value: 55,
      currency: 'eur',
      stripePromotionCodeId: null,
      maxRedemptions: 1,
      timesRedeemed: 0,
      redeemBy: null,
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
        id: 2,
        code: 'gift55',
        type: 'amount_off',
        value: 55,
        currency: 'eur',
        status: 'active',
        timesRedeemed: 0,
      },
    ])

    const discount = await resolveTenantDiscountCode(payload as never, 7, 'GIFT55')
    expect(discount?.code).toBe('GIFT55')
    expect(discount?.value).toBe(55)
  })

  it('rejects maxRedemptions=1 codes that are already redeemed', async () => {
    const payload = makePayload([
      {
        id: 3,
        code: 'ONCE01',
        type: 'amount_off',
        value: 30,
        currency: 'eur',
        status: 'archived',
        maxRedemptions: 1,
        timesRedeemed: 1,
      },
    ])

    const checked = await checkTenantDiscountCode(payload as never, 7, 'ONCE01')
    expect(checked).toEqual({
      ok: false,
      error: 'This discount code has already been used.',
    })
    expect(await resolveTenantDiscountCode(payload as never, 7, 'ONCE01')).toBeUndefined()
  })

  it('rejects active codes whose timesRedeemed already meets maxRedemptions', async () => {
    const payload = makePayload([
      {
        id: 4,
        code: 'MULTI5',
        type: 'percentage_off',
        value: 10,
        status: 'active',
        maxRedemptions: 5,
        timesRedeemed: 5,
      },
    ])

    const checked = await checkTenantDiscountCode(payload as never, 7, 'MULTI5')
    expect(checked.ok).toBe(false)
    if (!checked.ok) {
      expect(checked.error).toMatch(/already been used/i)
    }
  })
})

describe('isDiscountCodeExhausted', () => {
  it('is false when maxRedemptions is unlimited', () => {
    expect(isDiscountCodeExhausted({ maxRedemptions: null, timesRedeemed: 99 })).toBe(false)
  })

  it('is true when timesRedeemed >= maxRedemptions', () => {
    expect(isDiscountCodeExhausted({ maxRedemptions: 1, timesRedeemed: 1 })).toBe(true)
    expect(isDiscountCodeExhausted({ maxRedemptions: 2, timesRedeemed: 1 })).toBe(false)
  })
})

describe('consumeDiscountCodeRedemption', () => {
  it('increments timesRedeemed and archives when maxRedemptions is 1', async () => {
    const docs = [
      {
        id: 10,
        code: 'GIFT30',
        type: 'amount_off',
        value: 30,
        currency: 'eur',
        status: 'active',
        maxRedemptions: 1,
        timesRedeemed: 0,
        lastConsumedHoldId: null,
      },
    ]
    const payload = makePayload(docs)

    const result = await consumeDiscountCodeRedemption({
      payload: payload as never,
      tenantId: 7,
      discountCode: 'GIFT30',
      holdId: 99,
    })

    expect(result).toEqual({
      ok: true,
      timesRedeemed: 1,
      archived: true,
      idempotent: false,
    })
    expect(docs[0]?.status).toBe('archived')
    expect(docs[0]?.timesRedeemed).toBe(1)
    expect(docs[0]?.lastConsumedHoldId).toBe(99)
  })

  it('is idempotent for the same holdId', async () => {
    const docs = [
      {
        id: 11,
        code: 'GIFT30',
        type: 'amount_off',
        value: 30,
        currency: 'eur',
        status: 'archived',
        maxRedemptions: 1,
        timesRedeemed: 1,
        lastConsumedHoldId: 42,
      },
    ]
    const payload = makePayload(docs)

    const result = await consumeDiscountCodeRedemption({
      payload: payload as never,
      tenantId: 7,
      discountCode: 'GIFT30',
      holdId: 42,
    })

    expect(result).toMatchObject({ ok: true, idempotent: true, timesRedeemed: 1 })
    expect(payload.update).not.toHaveBeenCalled()
  })

  it('rejects a second different hold when maxRedemptions is 1', async () => {
    const docs = [
      {
        id: 12,
        code: 'GIFT30',
        type: 'amount_off',
        value: 30,
        currency: 'eur',
        status: 'archived',
        maxRedemptions: 1,
        timesRedeemed: 1,
        lastConsumedHoldId: 1,
      },
    ]
    const payload = makePayload(docs)

    const result = await consumeDiscountCodeRedemption({
      payload: payload as never,
      tenantId: 7,
      discountCode: 'GIFT30',
      holdId: 2,
    })

    expect(result).toEqual({ ok: false, reason: 'inactive' })
  })
})
