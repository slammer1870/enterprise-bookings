/**
 * Book in, land on a 2-place class, then reload.
 *
 * The first render still has both places. Checkout then reserves one for this
 * viewer, so a reload's remainingCapacity is 1. Reload must not release that
 * hold, and the reloaded page must still show 2 places the owner can adjust.
 */
import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { BookingPageClientSmart } from '../../src/components/bookings/booking-page-client-smart'
import type { Timeslot } from '@repo/shared-types'
import '@testing-library/jest-dom/vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => ({ get: () => null }),
}))

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
  useMutation: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ holdId: 1, quantity: 1, expiresAt: '2099-01-01' }),
    isPending: false,
  }),
}))

vi.mock('../../src/components/bookings/booking-summary', () => ({
  BookingSummary: () => <div data-testid="booking-summary" />,
}))

const RELEASE_URL = '/api/bookings/release-hold'
const ownHold = { id: 9, quantity: 1, expiresAt: '2099-01-01T00:00:00.000Z' }

function twoPlaceTimeslot(remainingCapacity: number): Timeslot {
  return {
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
      places: 2,
      description: '',
      paymentMethods: {
        allowedDropIn: { id: 1, adjustable: true, price: 10 },
        allowedPlans: [],
        allowedClassPasses: [],
      },
    },
  } as unknown as Timeslot
}

function renderBookingPage(remainingCapacity: number, hold: typeof ownHold | null = null) {
  return render(
    <BookingPageClientSmart
      timeslot={twoPlaceTimeslot(remainingCapacity)}
      PaymentMethodsComponent={vi.fn().mockReturnValue(<div data-testid="payment-methods" />) as never}
      useCheckoutHolds={true}
      releaseHoldApiUrl={RELEASE_URL}
      initialCheckoutHold={hold}
    />,
  )
}

function installReleaseRecorder() {
  const calls: string[] = []

  class RecordingXHR {
    url = ''
    open(_method: string, url: string) {
      this.url = url
    }
    setRequestHeader() {}
    send() {
      calls.push(this.url)
    }
  }

  vi.stubGlobal('XMLHttpRequest', RecordingXHR)
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      calls.push(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url)
      return new Response(null, { status: 204 })
    }),
  )

  return calls
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('Booking page reload — two places, viewer owns one hold', () => {
  it('keeps the hold on reload and still shows two adjustable places', () => {
    const releaseCalls = installReleaseRecorder()

    const firstVisit = renderBookingPage(2)
    expect(screen.getByText('2 places remaining')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /increase quantity/i })).toBeEnabled()

    // Browser reload fires these before the next document is rendered.
    window.dispatchEvent(new Event('beforeunload'))
    window.dispatchEvent(new Event('pagehide'))
    firstVisit.unmount()

    expect(releaseCalls).not.toContain(RELEASE_URL)

    renderBookingPage(1, ownHold)
    expect(screen.queryByText('1 place remaining')).not.toBeInTheDocument()
    expect(screen.getByText('2 places remaining')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /increase quantity/i }))
    expect(screen.getByText('2')).toBeInTheDocument()
  })
})
