import { describe, it, expect } from 'vitest'
import { mapStripeCouponToPayloadFields } from '@/lib/stripe-connect/webhook/sync-discount-codes'

describe('mapStripeCouponToPayloadFields', () => {
  it('maps percent_off', () => {
    const mapped = mapStripeCouponToPayloadFields({
      percent_off: 20,
      duration: 'once',
    })
    expect(mapped).toMatchObject({
      type: 'percentage_off',
      value: 20,
      currency: null,
      duration: 'once',
    })
  })

  it('maps amount_off to currency units', () => {
    const mapped = mapStripeCouponToPayloadFields({
      amount_off: 1050,
      currency: 'eur',
      duration: 'once',
    })
    expect(mapped).toMatchObject({
      type: 'amount_off',
      value: 10.5,
      currency: 'eur',
      duration: 'once',
    })
  })
})
