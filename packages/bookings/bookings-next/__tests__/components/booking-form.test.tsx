import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BookingForm } from '../../src/components/bookings/booking-form'
import type { Lesson } from '@repo/shared-types'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useTRPC } from '@repo/trpc/client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

// Mock dependencies
vi.mock('@repo/trpc/client', () => ({
  useTRPC: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
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

describe('BookingForm', () => {
  let queryClient: QueryClient
  let mockMutateAsync: ReturnType<typeof vi.fn>
  let mockRouter: { push: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })

    mockMutateAsync = vi.fn()
    mockRouter = { push: vi.fn() }

    ;(useRouter as any).mockReturnValue(mockRouter)
    ;(useTRPC as any).mockReturnValue({
      bookings: {
        createBookings: {
          mutationOptions: vi.fn((options) => ({
            mutationFn: mockMutateAsync,
            onSuccess: options.onSuccess,
            onError: options.onError,
          })),
        },
      },
    })
  })

  const renderComponent = (lesson: Lesson, quantity: number, onSuccessRedirect?: string) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <BookingForm lesson={lesson} quantity={quantity} onSuccessRedirect={onSuccessRedirect} />
      </QueryClientProvider>
    )
  }

  it('renders booking form with correct information', () => {
    const lesson = createMockLesson(5)

    renderComponent(lesson, 2)

    expect(screen.getByText('Total Slots')).toBeInTheDocument()
    expect(screen.getByText('2 slots to book')).toBeInTheDocument()
    expect(screen.getByText('Remaining Capacity')).toBeInTheDocument()
    expect(screen.getByText('5 available')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Book 2 Slots/i })).toBeInTheDocument()
  })

  it('displays singular form for single slot', () => {
    const lesson = createMockLesson(5)

    renderComponent(lesson, 1)

    expect(screen.getByText('1 slot to book')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Book 1 Slot/i })).toBeInTheDocument()
  })

  it('submits booking when form is submitted', async () => {
    const user = userEvent.setup()
    const lesson = createMockLesson(5)
    const mockBookings = [{ id: 1 }, { id: 2 }]

    mockMutateAsync.mockResolvedValue(mockBookings)

    renderComponent(lesson, 2)

    const submitButton = screen.getByRole('button', { name: /Book 2 Slots/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalled()
      // Check the first argument (the actual mutation variables)
      const callArgs = mockMutateAsync.mock.calls[0]
      expect(callArgs[0]).toEqual({
        lessonId: 1,
        quantity: 2,
      })
    })
  })

  it('shows success toast and redirects on successful booking', async () => {
    const user = userEvent.setup()
    const lesson = createMockLesson(5)
    const mockBookings = [{ id: 1 }, { id: 2 }]

    mockMutateAsync.mockResolvedValue(mockBookings)

    renderComponent(lesson, 2, '/dashboard')

    const submitButton = screen.getByRole('button', { name: /Book 2 Slots/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Successfully booked 2 slots!')
      expect(mockRouter.push).toHaveBeenCalledWith('/dashboard')
    })
  })

  it('shows error toast on booking failure', async () => {
    const user = userEvent.setup()
    const lesson = createMockLesson(5)
    const error = { message: 'Booking failed' }

    mockMutateAsync.mockRejectedValue(error)

    renderComponent(lesson, 2)

    const submitButton = screen.getByRole('button', { name: /Book 2 Slots/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Booking failed')
    })
  })

  it('disables submit button when quantity exceeds capacity', () => {
    const lesson = createMockLesson(5)

    renderComponent(lesson, 10) // Quantity exceeds capacity

    const submitButton = screen.getByRole('button', { name: /Book 10 Slots/i })
    expect(submitButton).toBeDisabled()
  })

  it('disables submit button when quantity is less than 1', () => {
    const lesson = createMockLesson(5)

    renderComponent(lesson, 0) // Invalid quantity

    const submitButton = screen.getByRole('button')
    expect(submitButton).toBeDisabled()
  })

  it('shows loading state during submission', async () => {
    const user = userEvent.setup()
    const lesson = createMockLesson(5)

    // Create a promise that we can control
    let resolvePromise: (value: any) => void
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve
    })

    mockMutateAsync.mockReturnValue(pendingPromise)

    renderComponent(lesson, 2)

    const submitButton = screen.getByRole('button', { name: /Book 2 Slots/i })
    await user.click(submitButton)

    // Should show loading state
    await waitFor(() => {
      expect(screen.getByText(/Creating Booking/i)).toBeInTheDocument()
      expect(screen.getByRole('button')).toBeDisabled()
    })

    // Resolve the promise
    resolvePromise!([{ id: 1 }, { id: 2 }])
  })
})
