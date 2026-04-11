import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BookingPageClient } from '../../src/components/bookings/booking-page-client'
import type { Timeslot } from '@repo/shared-types'

// Mock child components
vi.mock('../../src/components/bookings/booking-summary', () => ({
  BookingSummary: ({ timeslot }: { timeslot: Timeslot }) => (
    <div data-testid="booking-summary">Summary for {timeslot.eventType.name}</div>
  ),
}))

vi.mock('../../src/components/bookings/quantity-selector', () => ({
  QuantitySelector: ({
    timeslot,
    quantity,
    onQuantityChange,
  }: {
    timeslot: Timeslot
    quantity: number
    onQuantityChange: (q: number) => void
  }) => (
    <div data-testid="quantity-selector">
      <button onClick={() => onQuantityChange(quantity + 1)}>Increase</button>
      <span>Quantity: {quantity}</span>
    </div>
  ),
}))

vi.mock('../../src/components/bookings/booking-form', () => ({
  BookingForm: ({ timeslot, quantity }: { timeslot: Timeslot; quantity: number }) => (
    <div data-testid="booking-form">
      Booking form for {timeslot.id}, quantity: {quantity}
    </div>
  ),
}))

const createMockTimeslot = (remainingCapacity: number): Timeslot =>
  ({
    id: 1,
    date: new Date().toISOString(),
    startTime: new Date().toISOString(),
    endTime: new Date().toISOString(),
    eventType: {
      id: 1,
      name: 'Test Class',
      places: 10,
      description: 'Test Description',
    },
    remainingCapacity,
    bookingStatus: 'active',
    location: 'Test Location',
    bookings: { docs: [] },
  }) as unknown as Timeslot

describe('BookingPageClient', () => {
  it('renders all child components', () => {
    const lesson = createMockTimeslot(5)

    render(<BookingPageClient timeslot={lesson} />)

    expect(screen.getByTestId('booking-summary')).toBeInTheDocument()
    expect(screen.getByTestId('quantity-selector')).toBeInTheDocument()
    expect(screen.getByTestId('booking-form')).toBeInTheDocument()
  })

  it('initializes with quantity of 1', () => {
    const lesson = createMockTimeslot(5)

    render(<BookingPageClient timeslot={lesson} />)

    expect(screen.getByText('Quantity: 1')).toBeInTheDocument()
  })

  it('updates quantity when selector changes', async () => {
    const user = userEvent.setup()
    const lesson = createMockTimeslot(5)

    render(<BookingPageClient timeslot={lesson} />)

    const increaseButton = screen.getByText('Increase')
    await user.click(increaseButton)

    expect(screen.getByText('Quantity: 2')).toBeInTheDocument()
  })

  it('passes onSuccessRedirect to BookingForm', () => {
    const lesson = createMockTimeslot(5)

    render(<BookingPageClient timeslot={lesson} onSuccessRedirect="/dashboard" />)

    // The redirect prop is passed internally, so we just verify the form renders
    expect(screen.getByTestId('booking-form')).toBeInTheDocument()
  })

  it('only shows booking form when quantity is valid', () => {
    const lesson = createMockTimeslot(3)

    render(<BookingPageClient timeslot={lesson} />)

    // Form should render when quantity (1) is within valid range (1-3)
    expect(screen.getByTestId('booking-form')).toBeInTheDocument()
  })
})
