import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, waitFor } from '@testing-library/react'
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

  afterEach(() => {
    vi.useRealTimers()
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
        metadata={{ timeslotId: '42' }}
        createPaymentIntentUrl="/api/stripe/connect/create-payment-intent"
      />
    )

    // With the abort-aware 100ms leading delay in CheckoutForm, we must wait for
    // the FIRST fetch to actually be initiated before re-rendering. Otherwise the
    // rerender's cleanup fires before the fetch starts and only one fetch ever runs,
    // breaking the "stale-response" scenario this test is verifying.
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1), { timeout: 2000 })

    rerender(
      <CheckoutForm
        price={8}
        priceComponent={<div>Price</div>}
        metadata={{ discountCode: 'SAVE20', timeslotId: '42' }}
        createPaymentIntentUrl="/api/stripe/connect/create-payment-intent"
      />
    )

    // Wait for the second fetch (post abort-aware delay for the new price).
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2), { timeout: 2000 })

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

  it('does not call onReserveCheckoutHold for rapid rerenders — only for the final settled render', async () => {
    vi.useFakeTimers()

    const holdMock = vi.fn().mockResolvedValue({ holdId: '1' })
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ clientSecret: 'pi_settled_secret_live', stripeAccountId: 'acct_settled' }),
        { status: 200 },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const baseProps = {
      priceComponent: <div />,
      createPaymentIntentUrl: '/api/test-pi',
      onReserveCheckoutHold: holdMock,
    }

    const { rerender } = render(
      <CheckoutForm {...baseProps} price={10} metadata={{ timeslotId: '1', quantity: '1' }} />,
    )

    // Simulate 3 more rapid rerenders (quantity 2→3→4) before the 100ms delay expires.
    rerender(<CheckoutForm {...baseProps} price={20} metadata={{ timeslotId: '1', quantity: '2' }} />)
    rerender(<CheckoutForm {...baseProps} price={30} metadata={{ timeslotId: '1', quantity: '3' }} />)
    rerender(<CheckoutForm {...baseProps} price={40} metadata={{ timeslotId: '1', quantity: '4' }} />)

    // No hold upserts yet — the abort-aware leading delay hasn't elapsed.
    expect(holdMock).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()

    // Advance past the 100ms abort-aware delay in checkout-form.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(150)
    })

    // Exactly one call — for the last settled render (quantity: '4').
    expect(holdMock).toHaveBeenCalledTimes(1)
    expect(holdMock).toHaveBeenCalledWith(expect.objectContaining({ quantity: '4' }))
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
        metadata={{ timeslotId: '42', quantity: '1' }}
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
        metadata={{ quantity: '1', timeslotId: '42' }}
        createPaymentIntentUrl="/api/stripe/connect/create-payment-intent"
      />
    )

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
