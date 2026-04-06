import { describe, expect, it } from 'vitest'
import { getStripeConnectNoticeFromSearch } from '@/components/admin/stripeConnectNotice'

describe('stripeConnectNotice', () => {
  it('returns a success notice for stripe_connect=success', () => {
    expect(
      getStripeConnectNoticeFromSearch('?stripe_connect=success', { connected: true }),
    ).toEqual({
      tone: 'success',
      message: 'Stripe connected successfully.',
    })
  })

  it('returns an error notice for stripe_connect=error', () => {
    expect(
      getStripeConnectNoticeFromSearch('?stripe_connect=error&message=User%20mismatch'),
    ).toEqual({
      tone: 'error',
      message: 'User mismatch',
    })
  })
})
