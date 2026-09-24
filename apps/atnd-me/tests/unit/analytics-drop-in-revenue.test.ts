import { describe, expect, it } from 'vitest'
import { attributedDropInRevenueCents } from '@/lib/analytics/dropInRevenue'

const trial100 = [{ minQuantity: 1, discountPercent: 100, type: 'trial' as const }]
const trial50 = [{ minQuantity: 1, discountPercent: 50, type: 'trial' as const }]
const qty10 = [{ minQuantity: 1, discountPercent: 10, type: 'normal' as const }]

describe('attributedDropInRevenueCents', () => {
  it('uses list price when no discounts apply', () => {
    expect(
      attributedDropInRevenueCents({
        listPriceEuros: 18,
        trialable: false,
      }),
    ).toBe(1800)
  })

  it('applies a 100% trial discount on the first booking', () => {
    expect(
      attributedDropInRevenueCents({
        listPriceEuros: 18,
        discountTiers: trial100,
        trialable: true,
      }),
    ).toBe(0)
  })

  it('does not apply a trial tier after the first booking', () => {
    expect(
      attributedDropInRevenueCents({
        listPriceEuros: 18,
        discountTiers: trial100,
        trialable: false,
      }),
    ).toBe(1800)
  })

  it('applies a 50% trial discount', () => {
    expect(
      attributedDropInRevenueCents({
        listPriceEuros: 10,
        discountTiers: trial50,
        trialable: true,
      }),
    ).toBe(500)
  })

  it('applies a normal quantity tier', () => {
    expect(
      attributedDropInRevenueCents({
        listPriceEuros: 20,
        discountTiers: qty10,
        trialable: false,
      }),
    ).toBe(1800)
  })

  it('applies a percentage promo on top of the list price', () => {
    expect(
      attributedDropInRevenueCents({
        listPriceEuros: 20,
        trialable: false,
        promo: { type: 'percentage_off', value: 25 },
      }),
    ).toBe(1500)
  })

  it('applies an amount-off promo', () => {
    expect(
      attributedDropInRevenueCents({
        listPriceEuros: 18,
        trialable: false,
        promo: { type: 'amount_off', value: 5, currency: 'eur' },
      }),
    ).toBe(1300)
  })

  it('applies promo after trial (100% trial stays €0)', () => {
    expect(
      attributedDropInRevenueCents({
        listPriceEuros: 18,
        discountTiers: trial100,
        trialable: true,
        promo: { type: 'percentage_off', value: 20 },
      }),
    ).toBe(0)
  })

  it('prefers stored amountCents, including zero', () => {
    expect(
      attributedDropInRevenueCents({
        listPriceEuros: 18,
        discountTiers: trial100,
        trialable: false,
        storedAmountCents: 0,
      }),
    ).toBe(0)
    expect(
      attributedDropInRevenueCents({
        listPriceEuros: 18,
        trialable: false,
        storedAmountCents: 1234,
      }),
    ).toBe(1234)
  })
})
