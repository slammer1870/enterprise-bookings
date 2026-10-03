// @vitest-environment jsdom

import { render } from '@testing-library/react'
import { createElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { trackEventMock } = vi.hoisted(() => ({
  trackEventMock: vi.fn(),
}))

vi.mock('@repo/analytics', () => ({
  useAnalyticsTracker: () => ({ trackEvent: trackEventMock }),
}))

import { BookingCompletedAnalytics } from '@/components/analytics/BookingCompletedAnalytics'
import {
  paymentIntentConversion,
  receiptPaymentMethodForAnalytics,
} from '@/lib/analytics/conversion'

describe('BookingCompletedAnalytics', () => {
  beforeEach(() => {
    trackEventMock.mockClear()
    sessionStorage.clear()
    window.history.replaceState({}, '', '/')
  })

  it('deduplicates a conversion across remounts and cleans sensitive URL data', () => {
    window.history.replaceState(
      {},
      '',
      '/success?payment_intent=pi_123&payment_intent_client_secret=secret&analyticsTracked=1',
    )

    const props = {
      eventName: 'Booking Completed' as const,
      bookingFlow: 'checkout' as const,
      quantity: 1,
      isTrial: false,
      paymentMethod: 'card' as const,
      revenue: { amount: 25, currency: 'EUR' },
      dedupeKey: 'payment-intent:pi_123',
    }
    const firstRender = render(createElement(BookingCompletedAnalytics, props))

    expect(trackEventMock).toHaveBeenCalledWith('Booking Completed', {
      booking_flow: 'checkout',
      quantity: 1,
      is_trial: false,
      payment_method: 'card',
      revenue: { amount: 25, currency: 'EUR' },
    })
    expect(window.location.search).toBe('?payment_intent=pi_123')

    firstRender.unmount()
    render(createElement(BookingCompletedAnalytics, props))

    expect(trackEventMock).toHaveBeenCalledTimes(1)
  })
})

describe('verified conversion analytics', () => {
  it('rejects unverified guest and cross-tenant payment intents', () => {
    const paymentIntent = {
      amount: 2500,
      currency: 'eur',
      metadata: { tenantId: '2', userId: '10' },
    }

    expect(
      paymentIntentConversion({ paymentIntent, tenantId: 2, requireGuestCheckout: true }),
    ).toBeNull()
    expect(
      paymentIntentConversion({
        paymentIntent: {
          ...paymentIntent,
          metadata: { ...paymentIntent.metadata, guestCheckout: 'true' },
        },
        tenantId: 3,
        requireGuestCheckout: true,
      }),
    ).toBeNull()
  })

  it('builds a verified course purchase with revenue', () => {
    expect(
      paymentIntentConversion({
        paymentIntent: {
          amount: 4999,
          currency: 'eur',
          metadata: {
            tenantId: '2',
            userId: '10',
            type: 'course_purchase',
          },
        },
        tenantId: 2,
        viewerUserId: 10,
      }),
    ).toEqual({
      eventName: 'Course Purchased',
      bookingFlow: 'course',
      quantity: 1,
      isTrial: false,
      paymentMethod: 'card',
      revenue: { amount: 49.99, currency: 'EUR' },
    })
  })

  it('requires the authenticated user and uses standard payment metadata fallbacks', () => {
    const paymentIntent = {
      amount: 3000,
      currency: 'eur',
      metadata: {
        tenantId: '2',
        userId: '10',
        quantity: '3',
      },
    }

    expect(paymentIntentConversion({ paymentIntent, tenantId: 2, viewerUserId: 11 })).toBeNull()
    expect(paymentIntentConversion({ paymentIntent, tenantId: 2, viewerUserId: 10 })).toMatchObject(
      {
        eventName: 'Booking Completed',
        bookingFlow: 'checkout',
        quantity: 3,
        isTrial: false,
        paymentMethod: 'card',
        revenue: { amount: 30, currency: 'EUR' },
      },
    )
  })

  it('recognizes existing event checkout metadata without inferring trial status', () => {
    const paymentIntent = {
      amount: 3000,
      currency: 'eur',
      metadata: {
        tenantId: '2',
        userId: '10',
        quantity: '2',
        eventCheckout: 'true',
      },
    }

    expect(paymentIntentConversion({ paymentIntent, tenantId: 2, viewerUserId: 10 })).toMatchObject(
      {
        bookingFlow: 'event',
        quantity: 2,
        isTrial: false,
      },
    )
  })

  it('distinguishes zero-amount checkout from a card payment', () => {
    expect(receiptPaymentMethodForAnalytics({ paymentMethod: 'stripe', amountPaidCents: 0 })).toBe(
      'free',
    )
    expect(
      receiptPaymentMethodForAnalytics({ paymentMethod: 'stripe', amountPaidCents: 2500 }),
    ).toBe('card')
    expect(
      receiptPaymentMethodForAnalytics({ paymentMethod: 'stripe', amountPaidCents: null }),
    ).toBe('card')
  })
})
