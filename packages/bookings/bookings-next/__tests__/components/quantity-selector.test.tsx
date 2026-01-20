import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuantitySelector } from '../../src/components/bookings/quantity-selector'
import type { Lesson } from '@repo/shared-types'

// Mock lesson data
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

describe('QuantitySelector', () => {
  it('renders with correct initial quantity', () => {
    const lesson = createMockLesson(5)
    const onQuantityChange = vi.fn()

    render(
      <QuantitySelector
        lesson={lesson}
        quantity={1}
        onQuantityChange={onQuantityChange}
      />
    )

    expect(screen.getByText('Number of Slots')).toBeInTheDocument()
    expect(screen.getByText('5 slots available')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument() // Displayed quantity
  })

  it('displays singular form when only 1 slot available', () => {
    const lesson = createMockLesson(1)
    const onQuantityChange = vi.fn()

    render(
      <QuantitySelector
        lesson={lesson}
        quantity={1}
        onQuantityChange={onQuantityChange}
      />
    )

    expect(screen.getByText('1 slot available')).toBeInTheDocument()
  })

  it('calls onQuantityChange when increase button is clicked', async () => {
    const user = userEvent.setup()
    const lesson = createMockLesson(5)
    const onQuantityChange = vi.fn()

    render(
      <QuantitySelector
        lesson={lesson}
        quantity={1}
        onQuantityChange={onQuantityChange}
      />
    )

    const increaseButton = screen.getByLabelText('Increase quantity')
    await user.click(increaseButton)

    expect(onQuantityChange).toHaveBeenCalledWith(2)
  })

  it('calls onQuantityChange when decrease button is clicked', async () => {
    const user = userEvent.setup()
    const lesson = createMockLesson(5)
    const onQuantityChange = vi.fn()

    render(
      <QuantitySelector
        lesson={lesson}
        quantity={3}
        onQuantityChange={onQuantityChange}
      />
    )

    const decreaseButton = screen.getByLabelText('Decrease quantity')
    await user.click(decreaseButton)

    expect(onQuantityChange).toHaveBeenCalledWith(2)
  })

  it('disables decrease button when quantity is at minimum', () => {
    const lesson = createMockLesson(5)
    const onQuantityChange = vi.fn()

    render(
      <QuantitySelector
        lesson={lesson}
        quantity={1}
        onQuantityChange={onQuantityChange}
      />
    )

    const decreaseButton = screen.getByLabelText('Decrease quantity')
    expect(decreaseButton).toBeDisabled()
  })

  it('disables increase button when quantity is at maximum', () => {
    const lesson = createMockLesson(3)
    const onQuantityChange = vi.fn()

    render(
      <QuantitySelector
        lesson={lesson}
        quantity={3}
        onQuantityChange={onQuantityChange}
      />
    )

    const increaseButton = screen.getByLabelText('Increase quantity')
    expect(increaseButton).toBeDisabled()
  })

  it('only allows selection up to remaining capacity', async () => {
    const user = userEvent.setup()
    const lesson = createMockLesson(3)
    const onQuantityChange = vi.fn()

    const { rerender } = render(
      <QuantitySelector
        lesson={lesson}
        quantity={1}
        onQuantityChange={onQuantityChange}
      />
    )

    const increaseButton = screen.getByLabelText('Increase quantity')
    
    // Click once to go from 1 -> 2
    await user.click(increaseButton)
    expect(onQuantityChange).toHaveBeenCalledWith(2)
    
    // Re-render with updated quantity to simulate parent updating the prop
    onQuantityChange.mockClear()
    rerender(
      <QuantitySelector
        lesson={lesson}
        quantity={2}
        onQuantityChange={onQuantityChange}
      />
    )
    
    // Click again to go from 2 -> 3
    const increaseButton2 = screen.getByLabelText('Increase quantity')
    await user.click(increaseButton2)
    expect(onQuantityChange).toHaveBeenCalledWith(3)
    
    // Re-render with updated quantity
    onQuantityChange.mockClear()
    rerender(
      <QuantitySelector
        lesson={lesson}
        quantity={3}
        onQuantityChange={onQuantityChange}
      />
    )
    
    // Third click should not call onQuantityChange (button disabled)
    const increaseButton3 = screen.getByLabelText('Increase quantity')
    expect(increaseButton3).toBeDisabled()
    await user.click(increaseButton3)
    expect(onQuantityChange).not.toHaveBeenCalled()
  })

  it('handles edge case when remainingCapacity is 0', () => {
    const lesson = createMockLesson(0)
    const onQuantityChange = vi.fn()

    render(
      <QuantitySelector
        lesson={lesson}
        quantity={1}
        onQuantityChange={onQuantityChange}
      />
    )

    // Should default to 1 when capacity is 0
    expect(screen.getByText('1 slot available')).toBeInTheDocument()
    // Increase button should be disabled
    expect(screen.getByLabelText('Increase quantity')).toBeDisabled()
  })
})
