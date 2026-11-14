import { describe, expect, it } from 'vitest'

import { isStripeTestAccount } from '@/lib/stripe-connect/test-accounts'

describe('isStripeTestAccount', () => {
  it('recognizes local seed accounts without treating real Stripe accounts as placeholders', () => {
    expect(isStripeTestAccount('acct_seed_dundrum')).toBe(true)
    expect(isStripeTestAccount('acct_cp_only_2')).toBe(true)
    expect(isStripeTestAccount('acct_1234real')).toBe(false)
  })
})
