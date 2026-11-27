import { beforeEach, describe, expect, it, vi } from 'vitest'

const retrieveMock = vi.fn()

vi.mock('@/lib/stripe/platform', () => ({
  getPlatformStripe: () => ({
    products: {
      retrieve: retrieveMock,
    },
  }),
}))

import { resolvePlanPriceId } from '@/blocks/SubscriptionCheckout/resolvePlanPriceId'

describe('resolvePlanPriceId', () => {
  beforeEach(() => {
    retrieveMock.mockReset()
  })

  it('returns price id from priceJSON string', async () => {
    const id = await resolvePlanPriceId({
      priceJSON: JSON.stringify({ id: 'price_from_json' }),
      stripeProductId: 'prod_unused',
    })
    expect(id).toBe('price_from_json')
    expect(retrieveMock).not.toHaveBeenCalled()
  })

  it('returns price id from priceJSON object', async () => {
    const id = await resolvePlanPriceId({
      priceJSON: { id: 'price_obj' },
    })
    expect(id).toBe('price_obj')
  })

  it('falls back to Stripe product default_price', async () => {
    retrieveMock.mockResolvedValueOnce({
      default_price: { id: 'price_default' },
    })
    const id = await resolvePlanPriceId(
      { stripeProductId: 'prod_123' },
      { stripeAccount: 'acct_test' },
    )
    expect(id).toBe('price_default')
    expect(retrieveMock).toHaveBeenCalledWith(
      'prod_123',
      { expand: ['default_price'] },
      { stripeAccount: 'acct_test' },
    )
  })

  it('returns null when neither priceJSON nor product resolves', async () => {
    retrieveMock.mockRejectedValueOnce(new Error('missing'))
    const id = await resolvePlanPriceId({ stripeProductId: 'prod_missing' })
    expect(id).toBeNull()
  })
})
