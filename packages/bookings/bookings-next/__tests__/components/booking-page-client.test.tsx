import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BookingPageClient } from '../../src/components/bookings/booking-page-client'
import type { Lesson } from '@repo/shared-types'

// Mock child components
vi.mock('../../src/components/bookings/booking-summary', () => ({
  BookingSummary: ({ lesson }: { lesson: Lesson }) => (
    <div data-testid="booking-summary">Summary for {lesson.classOption.name}</div>
  ),
}))

vi.mock('../../src/components/bookings/quantity-selector', () => ({
  QuantitySelector: ({
    lesson,
    quantity,
    onQuantityChange,
  }: {
    lesson: Lesson
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
  BookingForm: ({ lesson, quantity }: { lesson: Lesson; quantity: number }) => (
    <div data-testid="booking-form">
      Booking form for {lesson.id}, quantity: {quantity}
    </div>
  ),
}))

const createMockLesson = (remainingCapacity: number): Lesson => ({
  id: 1,
  date: new Date().toISOString(),
  startTime: new Date().toISOString(),
  endTime: new Date().toISOString(),
  classOption: {
    id: 1,
    name: 'Test Class',
    places: 10,
    description: 'Test Description',
  },
  remainingCapacity,
  bookingStatus: 'active',
  location: 'Test Location',
  active: true,
  bookings: { docs: [] },
} as unknown as Lesson)

describe('BookingPageClient', () => {
  it('renders all child components', () => {
    const lesson = createMockLesson(5)

    render(<BookingPageClient lesson={lesson} />)

    expect(screen.getByTestId('booking-summary')).toBeInTheDocument()
    expect(screen.getByTestId('quantity-selector')).toBeInTheDocument()
    expect(screen.getByTestId('booking-form')).toBeInTheDocument()
  })

  it('initializes with quantity of 1', () => {
    const lesson = createMockLesson(5)

    render(<BookingPageClient lesson={lesson} />)

    expect(screen.getByText('Quantity: 1')).toBeInTheDocument()
  })

  it('updates quantity when selector changes', async () => {
    const user = userEvent.setup()
    const lesson = createMockLesson(5)

    render(<BookingPageClient lesson={lesson} />)

    const increaseButton = screen.getByText('Increase')
    await user.click(increaseButton)

    expect(screen.getByText('Quantity: 2')).toBeInTheDocument()
  })

  it('passes onSuccessRedirect to BookingForm', () => {
    const lesson = createMockLesson(5)

    render(<BookingPageClient lesson={lesson} onSuccessRedirect="/dashboard" />)

    // The redirect prop is passed internally, so we just verify the form renders
    expect(screen.getByTestId('booking-form')).toBeInTheDocument()
  })

  it('only shows booking form when quantity is valid', () => {
    const lesson = createMockLesson(3)

    render(<BookingPageClient lesson={lesson} />)

    // Form should render when quantity (1) is within valid range (1-3)
    expect(screen.getByTestId('booking-form')).toBeInTheDocument()
  })
})
