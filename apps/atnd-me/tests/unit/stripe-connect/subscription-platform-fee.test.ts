import { beforeEach, describe, expect, it, vi } from 'vitest'
import type Stripe from 'stripe'
import {
  bookingFeeCentsFromMetadata,
  enforceApplicationFeeAmountOnInvoice,
  findExactApplicationFeePercent,
  healSubscriptionPlatformFee,
  isPlatformFeeProductName,
  isStripePlatformFeeSubscriptionItem,
  resolveApplicationFeePercent,
} from '@/lib/stripe-connect/subscriptionPlatformFee'

describe('subscriptionPlatformFee helpers', () => {
  it('recognises Platform fee and Booking fee product names', () => {
    expect(isPlatformFeeProductName('Platform fee')).toBe(true)
    expect(isPlatformFeeProductName('Booking fee')).toBe(true)
    expect(isPlatformFeeProductName('Membership')).toBe(false)
  })

  it('detects fee subscription items from expanded product name', () => {
    expect(
      isStripePlatformFeeSubscriptionItem({
        price: {
          product: { id: 'prod_fee', name: 'Platform fee', object: 'product' },
        } as Stripe.Price,
      }),
    ).toBe(true)
    expect(
      isStripePlatformFeeSubscriptionItem({
        price: {
          product: { id: 'prod_plan', name: 'Unlimited', object: 'product' },
        } as Stripe.Price,
      }),
    ).toBe(false)
  })

  it('parses bookingFeeAmount metadata', () => {
    expect(bookingFeeCentsFromMetadata({ bookingFeeAmount: '250' })).toBe(250)
    expect(bookingFeeCentsFromMetadata({ bookingFeeAmount: '0' })).toBeNull()
    expect(bookingFeeCentsFromMetadata({})).toBeNull()
  })

  it('finds an exact application_fee_percent for fee/total', () => {
    const pct = findExactApplicationFeePercent({ feeCents: 100, totalCents: 2500 })
    expect(pct).not.toBeNull()
    expect(Math.round((2500 * (pct! * 100)) / 10000)).toBe(100)
  })

  it('falls back when exact percent is unavailable', () => {
    const pct = resolveApplicationFeePercent({ feeCents: 1, totalCents: 3 })
    expect(pct).toBeGreaterThan(0)
  })
})

describe('enforceApplicationFeeAmountOnInvoice', () => {
  const update = vi.fn()

  beforeEach(() => {
    update.mockReset()
    update.mockResolvedValue({})
  })

  it('sets application_fee_amount on draft invoices from subscription metadata', async () => {
    const result = await enforceApplicationFeeAmountOnInvoice({
      stripeAccount: 'acct_1',
      stripe: { invoices: { update } },
      invoice: {
        id: 'in_1',
        status: 'draft',
        amount_due: 2600,
        application_fee_amount: null,
        parent: {
          subscription_details: {
            metadata: { bookingFeeAmount: '100', classPriceAmount: '2500' },
          },
        },
      },
    })

    expect(result).toBe('updated')
    expect(update).toHaveBeenCalledWith(
      'in_1',
      { application_fee_amount: 100 },
      { stripeAccount: 'acct_1' },
    )
  })

  it('skips when fee metadata is missing or invoice is not draft', async () => {
    await expect(
      enforceApplicationFeeAmountOnInvoice({
        stripeAccount: 'acct_1',
        stripe: { invoices: { update } },
        invoice: {
          id: 'in_2',
          status: 'open',
          amount_due: 2600,
          parent: {
            subscription_details: { metadata: { bookingFeeAmount: '100' } },
          },
        },
      }),
    ).resolves.toBe('skipped')

    await expect(
      enforceApplicationFeeAmountOnInvoice({
        stripeAccount: 'acct_1',
        stripe: { invoices: { update } },
        invoice: {
          id: 'in_3',
          status: 'draft',
          amount_due: 2600,
          parent: { subscription_details: { metadata: {} } },
        },
      }),
    ).resolves.toBe('skipped')

    expect(update).not.toHaveBeenCalled()
  })

  it('clamps application_fee_amount to the invoice total', async () => {
    await enforceApplicationFeeAmountOnInvoice({
      stripeAccount: undefined,
      stripe: { invoices: { update } },
      invoice: {
        id: 'in_4',
        status: 'draft',
        amount_due: 50,
        parent: {
          subscription_details: { metadata: { bookingFeeAmount: '100' } },
        },
      },
    })

    expect(update).toHaveBeenCalledWith('in_4', { application_fee_amount: 50 }, undefined)
  })
})

describe('healSubscriptionPlatformFee', () => {
  const pricesCreate = vi.fn()
  const subscriptionsUpdate = vi.fn()

  beforeEach(() => {
    pricesCreate.mockReset()
    subscriptionsUpdate.mockReset()
    pricesCreate.mockResolvedValue({ id: 'price_fee_new' })
    subscriptionsUpdate.mockResolvedValue({})
  })

  function planOnlySubscription(overrides: Partial<Stripe.Subscription> = {}): Stripe.Subscription {
    return {
      id: 'sub_1',
      object: 'subscription',
      application_fee_percent: null,
      metadata: { bookingFeeAmount: '100', classPriceAmount: '2500' },
      items: {
        object: 'list',
        data: [
          {
            id: 'si_plan',
            object: 'subscription_item',
            price: {
              id: 'price_plan',
              object: 'price',
              currency: 'eur',
              unit_amount: 2500,
              recurring: { interval: 'month', interval_count: 1 },
              product: { id: 'prod_plan', object: 'product', name: 'Unlimited' },
            },
          } as Stripe.SubscriptionItem,
        ],
        has_more: false,
        url: '',
      },
      ...overrides,
    } as Stripe.Subscription
  }

  it('re-adds a Platform fee item and application_fee_percent when the fee item is missing', async () => {
    const result = await healSubscriptionPlatformFee({
      stripeAccount: 'acct_1',
      stripe: {
        prices: { create: pricesCreate },
        subscriptions: { update: subscriptionsUpdate },
      },
      subscription: planOnlySubscription(),
    })

    expect(result).toBe('updated')
    expect(pricesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        unit_amount: 100,
        product_data: { name: 'Platform fee' },
      }),
      { stripeAccount: 'acct_1' },
    )
    expect(subscriptionsUpdate).toHaveBeenCalledWith(
      'sub_1',
      expect.objectContaining({
        items: [{ price: 'price_fee_new', quantity: 1 }],
        proration_behavior: 'none',
        application_fee_percent: expect.any(Number),
      }),
      { stripeAccount: 'acct_1' },
    )
  })

  it('skips when the fee item and percent are already correct', async () => {
    const pct = resolveApplicationFeePercent({ feeCents: 100, totalCents: 2600 })!
    const result = await healSubscriptionPlatformFee({
      stripeAccount: 'acct_1',
      stripe: {
        prices: { create: pricesCreate },
        subscriptions: { update: subscriptionsUpdate },
      },
      subscription: planOnlySubscription({
        application_fee_percent: pct,
        items: {
          object: 'list',
          data: [
            {
              id: 'si_plan',
              object: 'subscription_item',
              price: {
                id: 'price_plan',
                object: 'price',
                currency: 'eur',
                unit_amount: 2500,
                recurring: { interval: 'month', interval_count: 1 },
                product: { id: 'prod_plan', object: 'product', name: 'Unlimited' },
              },
            } as Stripe.SubscriptionItem,
            {
              id: 'si_fee',
              object: 'subscription_item',
              price: {
                id: 'price_fee',
                object: 'price',
                currency: 'eur',
                unit_amount: 100,
                recurring: { interval: 'month', interval_count: 1 },
                product: { id: 'prod_fee', object: 'product', name: 'Platform fee' },
              },
            } as Stripe.SubscriptionItem,
          ],
          has_more: false,
          url: '',
        },
      } as Partial<Stripe.Subscription>),
    })

    expect(result).toBe('skipped')
    expect(pricesCreate).not.toHaveBeenCalled()
    expect(subscriptionsUpdate).not.toHaveBeenCalled()
  })

  it('skips when bookingFeeAmount metadata is absent', async () => {
    const result = await healSubscriptionPlatformFee({
      stripeAccount: 'acct_1',
      stripe: {
        prices: { create: pricesCreate },
        subscriptions: { update: subscriptionsUpdate },
      },
      subscription: planOnlySubscription({ metadata: {} }),
    })
    expect(result).toBe('skipped')
  })
})
