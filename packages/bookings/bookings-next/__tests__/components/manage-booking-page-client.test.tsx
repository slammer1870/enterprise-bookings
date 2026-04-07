import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ManageBookingPageClient } from '../../src/components/bookings/manage-booking-page-client'
import type { Lesson, Booking } from '@repo/shared-types'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useTRPC } from '@repo/trpc/client'
import { useRouter } from 'next/navigation'

vi.mock('@repo/trpc/client', () => ({
  useTRPC: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

vi.mock('@repo/ui/components/ui/use-confirm', () => ({
  useConfirm: () => [
    () => null,
    vi.fn().mockResolvedValue(true),
  ],
}))

vi.mock('../../src/components/bookings/booking-summary', () => ({
  BookingSummary: () => <div data-testid="booking-summary">Summary</div>,
}))

const createMockLesson = (opts?: { hasPaymentMethods?: boolean }): Lesson =>
  ({
    id: 1,
    date: new Date().toISOString(),
    startTime: new Date().toISOString(),
    endTime: new Date().toISOString(),
    classOption: {
      id: 1,
      name: 'Test Class',
      places: 10,
      description: 'Test',
      paymentMethods: opts?.hasPaymentMethods
        ? { allowedDropIn: { id: 1 }, allowedPlans: [] }
        : undefined,
    },
    remainingCapacity: 5,
    bookingStatus: 'active',
    location: 'Test',
    active: true,
    bookings: { docs: [] },
  }) as unknown as Lesson

const createMockBooking = (id: number, status: 'confirmed' | 'pending'): Booking =>
  ({
    id,
    lesson: 1,
    user: 1,
    status,
    createdAt: new Date().toISOString(),
  }) as unknown as Booking

describe('ManageBookingPageClient', () => {
  let queryClient: QueryClient
  let mockCancelBooking: ReturnType<typeof vi.fn>
  let mockCreateBookings: ReturnType<typeof vi.fn>
  let mockSetBookingQuantity: ReturnType<typeof vi.fn>
  let mockCancelPendingBookingsForLesson: ReturnType<typeof vi.fn>

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    mockCancelBooking = vi.fn().mockResolvedValue({})
    mockCreateBookings = vi.fn().mockResolvedValue([])
    mockSetBookingQuantity = vi.fn().mockResolvedValue([])
    mockCancelPendingBookingsForLesson = vi.fn().mockResolvedValue({ cancelled: 0 })

    const mockConfirm = vi.fn().mockResolvedValue(true)
    ;(useTRPC as any).mockReturnValue({
      bookings: {
        getUserBookingsForLesson: {
          queryKey: (opts: { lessonId: number }) => ['bookings', 'getUserBookingsForLesson', opts],
          queryOptions: (opts: { lessonId: number }) => ({
            queryKey: ['bookings', 'getUserBookingsForLesson', opts],
            queryFn: () => [],
            initialData: undefined as Booking[] | undefined,
          }),
        },
        cancelBooking: {
          mutationOptions: (opts?: { onSuccess?: () => void; onError?: (e: any) => void }) => ({
            mutationFn: mockCancelBooking,
            onSuccess: opts?.onSuccess,
            onError: opts?.onError,
          }),
        },
        createBookings: {
          mutationOptions: (opts?: { onSuccess?: () => void; onError?: (e: any) => void }) => ({
            mutationFn: mockCreateBookings,
            onSuccess: opts?.onSuccess,
            onError: opts?.onError,
          }),
        },
        setMyBookingQuantityForLesson: {
          mutationOptions: (opts?: { onSuccess?: () => void; onError?: (e: any) => void }) => ({
            mutationFn: mockSetBookingQuantity,
            onSuccess: opts?.onSuccess,
            onError: opts?.onError,
          }),
        },
        cancelPendingBookingsForLesson: {
          mutationOptions: () => ({
            mutationFn: mockCancelPendingBookingsForLesson,
          }),
        },
      },
      lessons: {
        getByDate: { queryKey: () => [], queryOptions: () => ({ queryKey: [], queryFn: () => [] }) },
        getById: { queryKey: () => [], queryOptions: () => ({ queryKey: [], queryFn: () => [] }) },
        getByIdForBooking: { queryKey: () => [], queryOptions: () => ({ queryKey: [], queryFn: () => [] }) },
      },
    })
  })

  it('shows quantity view when all bookings are confirmed', async () => {
    const bookings = [
      createMockBooking(1, 'confirmed'),
      createMockBooking(2, 'confirmed'),
    ]
    ;(useTRPC as any).mockReturnValue({
      bookings: {
        getUserBookingsForLesson: {
          queryKey: (opts: { lessonId: number }) => ['bookings', 'getUserBookingsForLesson', opts],
          queryOptions: (opts: { lessonId: number }) => ({
            queryKey: ['bookings', 'getUserBookingsForLesson', opts],
            queryFn: () => bookings,
            initialData: bookings,
          }),
        },
        cancelBooking: { mutationOptions: () => ({ mutationFn: mockCancelBooking }) },
        createBookings: { mutationOptions: () => ({ mutationFn: mockCreateBookings }) },
        setMyBookingQuantityForLesson: { mutationOptions: () => ({ mutationFn: mockSetBookingQuantity }) },
        cancelPendingBookingsForLesson: { mutationOptions: () => ({ mutationFn: mockCancelPendingBookingsForLesson }) },
      },
      lessons: {
        getByDate: { queryKey: () => [], queryOptions: () => ({ queryKey: [], queryFn: () => [] }) },
        getById: { queryKey: () => [], queryOptions: () => ({ queryKey: [], queryFn: () => [] }) },
        getByIdForBooking: { queryKey: () => [], queryOptions: () => ({ queryKey: [], queryFn: () => [] }) },
      },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <ManageBookingPageClient lesson={createMockLesson()} initialBookings={bookings} />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByText(/update booking quantity/i)).toBeInTheDocument()
    })
    expect(screen.getByTestId('booking-quantity')).toHaveTextContent('2')
  })

  it('shows checkout (Complete Payment) when server returns confirmed + pending bookings', async () => {
    const bookings = [
      createMockBooking(1, 'confirmed'),
      createMockBooking(2, 'confirmed'),
      createMockBooking(3, 'pending'),
      createMockBooking(4, 'pending'),
      createMockBooking(5, 'pending'),
    ]
    const lesson = createMockLesson({ hasPaymentMethods: true })
    const PaymentMethodsStub = () => <div data-testid="payment-methods-stub">Payment methods</div>

    ;(useTRPC as any).mockReturnValue({
      bookings: {
        getUserBookingsForLesson: {
          queryKey: (opts: { lessonId: number }) => ['bookings', 'getUserBookingsForLesson', opts],
          queryOptions: (opts: { lessonId: number }) => ({
            queryKey: ['bookings', 'getUserBookingsForLesson', opts],
            queryFn: () => bookings,
            initialData: bookings,
          }),
        },
        cancelBooking: { mutationOptions: () => ({ mutationFn: mockCancelBooking }) },
        createBookings: { mutationOptions: () => ({ mutationFn: mockCreateBookings }) },
        setMyBookingQuantityForLesson: { mutationOptions: () => ({ mutationFn: mockSetBookingQuantity }) },
        cancelPendingBookingsForLesson: { mutationOptions: () => ({ mutationFn: mockCancelPendingBookingsForLesson }) },
      },
      lessons: {
        getByDate: { queryKey: () => [], queryOptions: () => ({ queryKey: [], queryFn: () => [] }) },
        getById: { queryKey: () => [], queryOptions: () => ({ queryKey: [], queryFn: () => [] }) },
        getByIdForBooking: { queryKey: () => [], queryOptions: () => ({ queryKey: [], queryFn: () => [] }) },
      },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <ManageBookingPageClient
          lesson={lesson}
          initialBookings={bookings}
          PaymentMethodsComponent={PaymentMethodsStub}
        />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('Complete Payment')).toBeInTheDocument()
    })
    expect(screen.getByText(/pending booking/i)).toBeInTheDocument()
    expect(screen.getByTestId('payment-methods-stub')).toBeInTheDocument()
  })

  it('does not cancel pending bookings when payment flow quantity changes in place', async () => {
    const lesson = createMockLesson({ hasPaymentMethods: true })
    ;(lesson.classOption as any).paymentMethods.allowedDropIn.adjustable = true
    const PaymentMethodsStub = () => <div data-testid="payment-methods-stub">Payment methods</div>
    let serverBookings = [createMockBooking(1, 'confirmed')]
    const newPendingBooking = createMockBooking(101, 'pending')
    mockCreateBookings.mockImplementation(async () => {
      serverBookings = [...serverBookings, newPendingBooking]
      return [newPendingBooking]
    })

    ;(useTRPC as any).mockReturnValue({
      bookings: {
        getUserBookingsForLesson: {
          queryKey: (opts: { lessonId: number }) => ['bookings', 'getUserBookingsForLesson', opts],
          queryOptions: (opts: { lessonId: number }) => ({
            queryKey: ['bookings', 'getUserBookingsForLesson', opts],
            queryFn: () => serverBookings,
            initialData: serverBookings,
          }),
        },
        cancelBooking: { mutationOptions: () => ({ mutationFn: mockCancelBooking }) },
        createBookings: { mutationOptions: (opts?: { onSuccess?: () => void; onError?: (e: any) => void }) => ({ mutationFn: mockCreateBookings, onSuccess: opts?.onSuccess, onError: opts?.onError }) },
        setMyBookingQuantityForLesson: { mutationOptions: () => ({ mutationFn: mockSetBookingQuantity }) },
        cancelPendingBookingsForLesson: { mutationOptions: () => ({ mutationFn: mockCancelPendingBookingsForLesson }) },
      },
      lessons: {
        getByDate: { queryKey: () => [], queryOptions: () => ({ queryKey: [], queryFn: () => [] }) },
        getById: { queryKey: () => [], queryOptions: () => ({ queryKey: [], queryFn: () => [] }) },
        getByIdForBooking: { queryKey: () => [], queryOptions: () => ({ queryKey: [], queryFn: () => [] }) },
      },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <ManageBookingPageClient lesson={lesson} initialBookings={serverBookings} PaymentMethodsComponent={PaymentMethodsStub} />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByText(/update booking quantity/i)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByLabelText('Increase quantity'))
    fireEvent.click(screen.getByRole('button', { name: 'Update Bookings' }))

    await waitFor(() => {
      expect(screen.getByText('Complete Payment')).toBeInTheDocument()
    })

    expect(mockCreateBookings).toHaveBeenCalled()
    expect(mockCreateBookings.mock.calls[0]?.[0]).toEqual({
      lessonId: 1,
      quantity: 1,
      status: 'pending',
    })
    expect(mockCancelPendingBookingsForLesson).not.toHaveBeenCalled()
    expect(screen.getByTestId('pending-booking-quantity')).toHaveTextContent('1')
  })

  it('cancels pending bookings when the checkout flow unmounts', async () => {
    const lesson = createMockLesson({ hasPaymentMethods: true })
    const PaymentMethodsStub = () => <div data-testid="payment-methods-stub">Payment methods</div>
    const pendingBookings = [createMockBooking(101, 'pending')]

    const { unmount } = render(
      <QueryClientProvider client={queryClient}>
        <ManageBookingPageClient lesson={lesson} initialBookings={pendingBookings} PaymentMethodsComponent={PaymentMethodsStub} />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('Complete Payment')).toBeInTheDocument()
    })

    unmount()

    await waitFor(() => {
      expect(mockCancelPendingBookingsForLesson).toHaveBeenCalled()
    })
    expect(mockCancelPendingBookingsForLesson.mock.calls[0]?.[0]).toEqual({ lessonId: 1 })
  })
})
