import { describe, expect, it } from 'vitest'
import {
  buildUpgradeConfirmCopy,
  formatEuroCents,
  upgradeConfirmTotalLabel,
} from '@/blocks/SubscriptionCheckout/subscriptionUpgradeConfirmSummary'

describe('subscriptionUpgradeConfirmSummary', () => {
  it('formats euro cents', () => {
    expect(formatEuroCents(1250)).toBe('€12.50')
  })

  it('builds recurring total with optional fee', () => {
    expect(
      upgradeConfirmTotalLabel({ newPlanPriceCents: 5000, bookingFeeCents: 200 }),
    ).toBe('€52.00')
    expect(
      upgradeConfirmTotalLabel({ newPlanPriceCents: 5000, bookingFeeCents: null }),
    ).toBe('€50.00')
    expect(
      upgradeConfirmTotalLabel({ newPlanPriceCents: null, bookingFeeCents: 200 }),
    ).toBeNull()
  })

  it('builds confirmation copy for current → new plan', () => {
    const copy = buildUpgradeConfirmCopy({
      currentPlan: {
        planId: 1,
        name: 'Basic',
        priceLabel: '€30.00 / month',
        priceCents: 3000,
        priceId: 'price_basic',
      },
      newPlan: {
        planId: 2,
        name: 'Unlimited',
        priceLabel: '€50.00 / month',
        priceCents: 5000,
        priceId: 'price_unlimited',
      },
      fee: { bookingFeeCents: 200, totalCents: 5200, currency: 'eur' },
    })

    expect(copy.title).toBe('Confirm subscription change')
    expect(copy.fromLabel).toContain('Basic')
    expect(copy.toLabel).toContain('Unlimited')
    expect(copy.feeLabel).toBe('Platform fee €2.00')
    expect(copy.totalLabel).toBe('€52.00')
    expect(copy.notice).toMatch(/prorated/i)
  })
})
