import { describe, expect, it } from 'vitest'

import {
  classBranchLedgerCents,
  expiredGiftVoucherBreakageCents,
} from '@/lib/stripe-connect/classBranchLedgerCents'

const gift = {
  type: 'amount_off' as const,
  value: 12,
  maxRedemptions: 1,
  sourcePaymentIntentId: 'pi_gift',
  rootPurchasedAt: '2026-01-01T00:00:00.000Z',
}

describe('classBranchLedgerCents', () => {
  it('adds a redeemed gift voucher back onto the class price', () => {
    expect(
      classBranchLedgerCents({
        cashCents: 800,
        classPriceBeforeDiscountEuros: 20,
        discount: gift,
      }),
    ).toBe(2000)
  })

  it('recognizes the class price when a gift voucher covers the charge', () => {
    expect(
      classBranchLedgerCents({
        cashCents: 0,
        classPriceBeforeDiscountEuros: 20,
        discount: { ...gift, value: 50 },
      }),
    ).toBe(2000)
  })

  it('leaves a percentage promo at the cash charged', () => {
    expect(
      classBranchLedgerCents({
        cashCents: 1600,
        classPriceBeforeDiscountEuros: 20,
        discount: { type: 'percentage_off', value: 20, maxRedemptions: 1, rootPurchasedAt: '2026-01-01' },
      }),
    ).toBe(1600)
  })

  it('leaves an amount-off promo that was not sold as a voucher at the cash charged', () => {
    expect(
      classBranchLedgerCents({
        cashCents: 1500,
        classPriceBeforeDiscountEuros: 20,
        discount: { type: 'amount_off', value: 5, maxRedemptions: 1 },
      }),
    ).toBe(1500)
  })
})

describe('expiredGiftVoucherBreakageCents', () => {
  const now = new Date('2026-06-01T00:00:00.000Z')

  it('credits the unused face value of an expired gift voucher', () => {
    expect(
      expiredGiftVoucherBreakageCents(
        {
          id: 4,
          ...gift,
          value: 30,
          redeemBy: '2020-01-01T00:00:00.000Z',
          timesRedeemed: 0,
        },
        now,
      ),
    ).toBe(3000)
  })

  it('leaves a redeemed gift voucher off breakage', () => {
    expect(
      expiredGiftVoucherBreakageCents(
        {
          id: 4,
          ...gift,
          redeemBy: '2020-01-01T00:00:00.000Z',
          timesRedeemed: 1,
        },
        now,
      ),
    ).toBeNull()
  })

  it('leaves a gift voucher that can still be redeemed', () => {
    expect(
      expiredGiftVoucherBreakageCents(
        {
          id: 4,
          ...gift,
          redeemBy: '2099-01-01T00:00:00.000Z',
          timesRedeemed: 0,
        },
        now,
      ),
    ).toBeNull()
  })
})
