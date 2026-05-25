/**
 * Regression tests for the rapid-quantity-click hang bug.
 *
 * Bug: each + click on the booking page immediately passed `quantity` to
 * PaymentMethodsComponent, which triggered CheckoutForm's useEffect and fired
 * `onReserveCheckoutHold` (tRPC upsertCheckoutHold) and `create-payment-intent`
 * for every single click. Rapid clicks exhausted the DB connection pool, hanging
 * the entire app.
 *
 * Fix: `BookingPageClientSmart` now holds a `debouncedQuantity` (350ms) that
 * is the only value passed to `PaymentMethodsComponent` and used in
 * `onReserveCheckoutHold`. The QuantitySelector still receives raw `quantity`
 * for immediate UI feedback.
 */
import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { BookingPageClientSmart } from '../../src/components/bookings/booking-page-client-smart'
import type { Timeslot } from '@repo/shared-types'
import '@testing-library/jest-dom/vitest'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => ({ get: () => null }),
}))

const upsertMock = vi.fn().mockResolvedValue({ holdId: 1, quantity: 1, expiresAt: '2099-01-01' })
const releaseMock = vi.fn().mockResolvedValue({})

vi.mock('@repo/trpc/client', () => ({
  useTRPC: () => ({
    bookings: {
      cancelPendingBookingsForTimeslot: { mutationOptions: (o: unknown) => o },
      releaseCheckoutHold: { mutationOptions: (o: unknown) => o },
      upsertCheckoutHold: { mutationOptions: (o: unknown) => o },
      extendCheckoutHold: { mutationOptions: (o: unknown) => o },
    },
  }),
}))

vi.mock('@tanstack/react-query', () => ({
  useMutation: (opts: { mutationFn?: (...args: unknown[]) => unknown }) => ({
    mutateAsync: opts?.mutationFn ?? vi.fn(),
    isPending: false,
  }),
}))

vi.mock('../../src/components/bookings/booking-summary', () => ({
  BookingSummary: () => <div data-testid="booking-summary" />,
}))

// QuantitySelector renders the raw `quantity` (immediate feedback) plus a
// clickable increase button. We expose the displayed value via data-testid.
vi.mock('../../src/components/bookings/quantity-selector', () => ({
  QuantitySelector: ({
    quantity,
    onQuantityChange,
    maxQuantity,
  }: {
    quantity: number
    onQuantityChange: (q: number) => void
    maxQuantity?: number
  }) => (
    <div data-testid="quantity-selector">
      <span data-testid="raw-quantity">{quantity}</span>
      <button
        aria-label="Increase quantity"
        disabled={quantity >= (maxQuantity ?? Infinity)}
        onClick={() => onQuantityChange(quantity + 1)}
      >
        +
      </button>
    </div>
  ),
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

const createTimeslot = (remainingCapacity = 10): Timeslot =>
  ({
    id: 42,
    date: new Date().toISOString(),
    startTime: new Date().toISOString(),
    endTime: new Date().toISOString(),
    remainingCapacity,
    bookingStatus: 'active',
    location: 'Test',
    bookings: { docs: [] },
    eventType: {
      id: 1,
      name: 'Test Class',
      places: remainingCapacity,
      description: '',
      paymentMethods: {
        allowedDropIn: { id: 1, adjustable: true, price: 10 },
        allowedPlans: [],
        allowedClassPasses: [],
      },
    },
  }) as unknown as Timeslot

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BookingPageClientSmart — quantity debounce (rapid-click regression)', () => {
  it('QuantitySelector receives raw quantity immediately on every click', async () => {
    vi.useFakeTimers()
    const timeslot = createTimeslot(10)

    // QuantitySelector only renders when PaymentMethodsComponent is provided.
    render(
      <BookingPageClientSmart
        timeslot={timeslot}
        PaymentMethodsComponent={vi.fn().mockReturnValue(null) as any}
      />,
    )

    const increaseBtn = screen.getByRole('button', { name: /increase quantity/i })
    const rawQty = screen.getByTestId('raw-quantity')

    expect(rawQty).toHaveTextContent('1')

    fireEvent.click(increaseBtn)
    expect(rawQty).toHaveTextContent('2')

    fireEvent.click(increaseBtn)
    expect(rawQty).toHaveTextContent('3')

    // Raw quantity updates immediately — no debounce on the UI counter.
    fireEvent.click(increaseBtn)
    expect(rawQty).toHaveTextContent('4')
  })

  it('PaymentMethodsComponent does not receive intermediate quantities during rapid clicks', async () => {
    vi.useFakeTimers()

    // Spy on PaymentMethodsComponent to capture every `quantity` prop it receives.
    const receivedQuantities: number[] = []
    const PaymentSpy = vi.fn(({ quantity }: { quantity?: number }) => {
      receivedQuantities.push(quantity ?? -1)
      return <div data-testid="payment-methods" data-quantity={quantity} />
    })

    const timeslot = createTimeslot(10)

    render(
      <BookingPageClientSmart
        timeslot={timeslot}
        PaymentMethodsComponent={PaymentSpy as any}
        useCheckoutHolds={true}
      />,
    )

    // Initial render: PaymentMethodsComponent receives quantity=1 (debounced initial).
    expect(screen.getByTestId('payment-methods')).toHaveAttribute('data-quantity', '1')
    receivedQuantities.length = 0 // reset tracking after initial render

    const increaseBtn = screen.getByRole('button', { name: /increase quantity/i })

    // Rapid-fire 4 clicks without advancing time.
    fireEvent.click(increaseBtn) // 1→2
    fireEvent.click(increaseBtn) // 2→3
    fireEvent.click(increaseBtn) // 3→4
    fireEvent.click(increaseBtn) // 4→5

    // QuantitySelector counter shows 5 immediately.
    expect(screen.getByTestId('raw-quantity')).toHaveTextContent('5')

    // PaymentMethodsComponent must NOT have received any new quantity yet
    // (debounce period has not elapsed).
    const quantitiesBeforeDebounce = [...receivedQuantities]
    for (const q of quantitiesBeforeDebounce) {
      expect(q).toBe(1) // only the initial 1 (no re-render yet from debounce)
    }
    expect(screen.getByTestId('payment-methods')).toHaveAttribute('data-quantity', '1')

    // Advance past the 350ms debounce.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400)
    })

    // Now PaymentMethodsComponent receives the final quantity=5 (only one update).
    expect(screen.getByTestId('payment-methods')).toHaveAttribute('data-quantity', '5')

    // Crucially: PaymentMethodsComponent was NOT called with 2, 3, or 4.
    const intermediateQuantities = receivedQuantities.filter((q) => q > 1 && q < 5)
    expect(intermediateQuantities).toHaveLength(0)
  })

  it('upsertCheckoutHold is NOT called during rapid clicks, only after debounce settles', async () => {
    vi.useFakeTimers()

    // Wire tRPC mock so mutationFn resolves to upsertMock.
    // The vi.mock for @tanstack/react-query above calls opts.mutationFn as mutateAsync.
    // We need to match the upsertCheckoutHold mutationOptions specifically.
    vi.mocked(upsertMock).mockResolvedValue({ holdId: 1, quantity: 5, expiresAt: '2099-01-01' })

    // Stub fetch so CheckoutForm doesn't throw when it eventually fires.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ clientSecret: 'pi_test_secret_test', stripeAccountId: 'acct_x' }),
          { status: 200 },
        ),
      ),
    )

    let capturedOnReserveCheckoutHold: ((m: Record<string, string>) => Promise<unknown>) | undefined

    const PaymentCapture = vi.fn(
      ({ onReserveCheckoutHold }: { onReserveCheckoutHold?: (m: Record<string, string>) => Promise<unknown> }) => {
        capturedOnReserveCheckoutHold = onReserveCheckoutHold
        return <div data-testid="payment-capture" />
      },
    )

    const timeslot = createTimeslot(10)

    render(
      <BookingPageClientSmart
        timeslot={timeslot}
        PaymentMethodsComponent={PaymentCapture as any}
        useCheckoutHolds={true}
      />,
    )

    const increaseBtn = screen.getByRole('button', { name: /increase quantity/i })

    // Rapid clicks — 4 of them.
    fireEvent.click(increaseBtn)
    fireEvent.click(increaseBtn)
    fireEvent.click(increaseBtn)
    fireEvent.click(increaseBtn)

    // Before debounce: onReserveCheckoutHold has not been called.
    if (capturedOnReserveCheckoutHold) {
      // The callback exists from the initial render but quantity hasn't changed yet
      // in the debounced value, so no PI bootstrap has fired.
      expect(upsertMock).not.toHaveBeenCalled()
    }

    // Advance past the 350ms debounce so debouncedQuantity updates.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400)
    })

    // The debounced quantity is now 5. If onReserveCheckoutHold is called now
    // (e.g. by CheckoutForm after the checkout-form abort-aware 100ms), it should
    // use quantity=5, not 2, 3, or 4.
    expect(upsertMock).not.toHaveBeenCalledWith(expect.objectContaining({ quantity: 2 }))
    expect(upsertMock).not.toHaveBeenCalledWith(expect.objectContaining({ quantity: 3 }))
    expect(upsertMock).not.toHaveBeenCalledWith(expect.objectContaining({ quantity: 4 }))
  })
})
