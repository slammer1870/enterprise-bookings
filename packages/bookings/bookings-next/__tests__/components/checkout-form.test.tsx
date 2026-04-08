import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import CheckoutForm from '../../../../payments/payments-next/src/components/checkout-form'

vi.mock('@repo/analytics', () => ({
  useAnalyticsTracker: () => ({
    trackEvent: vi.fn(),
  }),
}))

vi.mock('@stripe/stripe-js', () => ({
  loadStripe: vi.fn(() => Promise.resolve({})),
}))

vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: React.ReactNode; options?: { clientSecret?: string } }) => (
    <>{children}</>
  ),
  PaymentElement: () => <div data-testid="payment-element" />,
  useStripe: () => ({ confirmPayment: vi.fn() }),
  useElements: () => ({}),
}))

function deferred<T>() {
  let resolve!: (_value: T) => void

  const promise = new Promise<T>((res) => {
    resolve = res
  })

  return { promise, resolve }
}

describe('CheckoutForm', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    vi.stubEnv('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'pk_test_123')
  })

  it('keeps the newest payment intent when earlier requests resolve later', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const first = deferred<Response>()
    const second = deferred<Response>()
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise)

    vi.stubGlobal('fetch', fetchMock)

    const { rerender } = render(
      <CheckoutForm
        price={10}
        priceComponent={<div>Price</div>}
        metadata={{ lessonId: '42' }}
        createPaymentIntentUrl="/api/stripe/connect/create-payment-intent"
      />
    )

    rerender(
      <CheckoutForm
        price={8}
        priceComponent={<div>Price</div>}
        metadata={{ discountCode: 'SAVE20', lessonId: '42' }}
        createPaymentIntentUrl="/api/stripe/connect/create-payment-intent"
      />
    )

    second.resolve(
      new Response(
        JSON.stringify({
          clientSecret: 'pi_discounted_secret_live',
          stripeAccountId: 'acct_discounted',
        }),
        { status: 200 }
      )
    )

    await waitFor(() => {
      expect(consoleLogSpy).toHaveBeenCalledWith('Payment intent created successfully')
    })

    expect(
      consoleLogSpy.mock.calls.filter(([message]) => message === 'Payment intent created successfully')
        .length
    ).toBe(1)

    first.resolve(
      new Response(
        JSON.stringify({
          clientSecret: 'pi_full_secret_live',
          stripeAccountId: 'acct_full',
        }),
        { status: 200 }
      )
    )

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    expect(
      consoleLogSpy.mock.calls.filter(([message]) => message === 'Payment intent created successfully')
        .length
    ).toBe(1)

    consoleLogSpy.mockRestore()
  })

  it('does not recreate the payment intent when metadata content is unchanged', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          clientSecret: 'pi_stable_secret_live',
          stripeAccountId: 'acct_stable',
        }),
        { status: 200 }
      )
    )

    vi.stubGlobal('fetch', fetchMock)

    const { rerender } = render(
      <CheckoutForm
        price={10}
        priceComponent={<div>Price</div>}
        metadata={{ lessonId: '42', quantity: '1' }}
        createPaymentIntentUrl="/api/stripe/connect/create-payment-intent"
      />
    )

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    rerender(
      <CheckoutForm
        price={10}
        priceComponent={<div>Price</div>}
        metadata={{ quantity: '1', lessonId: '42' }}
        createPaymentIntentUrl="/api/stripe/connect/create-payment-intent"
      />
    )

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
