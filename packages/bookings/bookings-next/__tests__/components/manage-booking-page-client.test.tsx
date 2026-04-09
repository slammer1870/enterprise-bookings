import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ManageBookingPageClient } from '../../src/components/bookings/manage-booking-page-client'
import type { Timeslot, Booking } from '@repo/shared-types'
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

const createMockTimeslot = (opts?: { hasPaymentMethods?: boolean }): Timeslot =>
  ({
    id: 1,
    date: new Date().toISOString(),
    startTime: new Date().toISOString(),
    endTime: new Date().toISOString(),
    eventType: {
      id: 1,
      name: 'Test Class',
      places: 10,
      description: 'Test',
      paymentMethods: opts?.hasPaymentMethods
        ? { allowedDropIn: { id: 1 } as any, allowedPlans: [] }
        : undefined,
    },
    remainingCapacity: 5,
    bookingStatus: 'active',
    location: 'Test',
    bookings: { docs: [] },
  }) as unknown as Timeslot

const createMockBooking = (id: number, status: 'confirmed' | 'pending'): Booking =>
  ({
    id,
    timeslot: 1 as any,
    user: 1 as any,
    status,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }) as unknown as Booking

describe('ManageBookingPageClient', () => {
  let queryClient: QueryClient
  let mockCancelBooking: ReturnType<typeof vi.fn>
  let mockCreateBookings: ReturnType<typeof vi.fn>
  let mockSetBookingQuantity: ReturnType<typeof vi.fn>
  let mockCancelPendingBookingsForTimeslot: ReturnType<typeof vi.fn>

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
    mockCancelPendingBookingsForTimeslot = vi.fn().mockResolvedValue({ cancelled: 0 })

    const mockConfirm = vi.fn().mockResolvedValue(true)
    ;(useTRPC as any).mockReturnValue({
      bookings: {
        getUserBookingsForTimeslot: {
          queryKey: (opts: { timeslotId: number }) => ['bookings', 'getUserBookingsForTimeslot', opts],
          queryOptions: (opts: { timeslotId: number }) => ({
            queryKey: ['bookings', 'getUserBookingsForTimeslot', opts],
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
        setMyBookingQuantityForTimeslot: {
          mutationOptions: (opts?: { onSuccess?: () => void; onError?: (e: any) => void }) => ({
            mutationFn: mockSetBookingQuantity,
            onSuccess: opts?.onSuccess,
            onError: opts?.onError,
          }),
        },
        cancelPendingBookingsForTimeslot: {
          mutationOptions: () => ({
            mutationFn: mockCancelPendingBookingsForTimeslot,
          }),
        },
      },
      timeslots: {
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
        getUserBookingsForTimeslot: {
          queryKey: (opts: { timeslotId: number }) => ['bookings', 'getUserBookingsForTimeslot', opts],
          queryOptions: (opts: { timeslotId: number }) => ({
            queryKey: ['bookings', 'getUserBookingsForTimeslot', opts],
            queryFn: () => bookings,
            initialData: bookings,
          }),
        },
        cancelBooking: { mutationOptions: () => ({ mutationFn: mockCancelBooking }) },
        createBookings: { mutationOptions: () => ({ mutationFn: mockCreateBookings }) },
        setMyBookingQuantityForTimeslot: { mutationOptions: () => ({ mutationFn: mockSetBookingQuantity }) },
        cancelPendingBookingsForTimeslot: { mutationOptions: () => ({ mutationFn: mockCancelPendingBookingsForTimeslot }) },
      },
      timeslots: {
        getByDate: { queryKey: () => [], queryOptions: () => ({ queryKey: [], queryFn: () => [] }) },
        getById: { queryKey: () => [], queryOptions: () => ({ queryKey: [], queryFn: () => [] }) },
        getByIdForBooking: { queryKey: () => [], queryOptions: () => ({ queryKey: [], queryFn: () => [] }) },
      },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <ManageBookingPageClient timeslot={createMockTimeslot()} initialBookings={bookings} />
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
    const lesson = createMockTimeslot({ hasPaymentMethods: true })
    const PaymentMethodsStub = () => <div data-testid="payment-methods-stub">Payment methods</div>

    ;(useTRPC as any).mockReturnValue({
      bookings: {
        getUserBookingsForTimeslot: {
          queryKey: (opts: { timeslotId: number }) => ['bookings', 'getUserBookingsForTimeslot', opts],
          queryOptions: (opts: { timeslotId: number }) => ({
            queryKey: ['bookings', 'getUserBookingsForTimeslot', opts],
            queryFn: () => bookings,
            initialData: bookings,
          }),
        },
        cancelBooking: { mutationOptions: () => ({ mutationFn: mockCancelBooking }) },
        createBookings: { mutationOptions: () => ({ mutationFn: mockCreateBookings }) },
        setMyBookingQuantityForTimeslot: { mutationOptions: () => ({ mutationFn: mockSetBookingQuantity }) },
        cancelPendingBookingsForTimeslot: { mutationOptions: () => ({ mutationFn: mockCancelPendingBookingsForTimeslot }) },
      },
      timeslots: {
        getByDate: { queryKey: () => [], queryOptions: () => ({ queryKey: [], queryFn: () => [] }) },
        getById: { queryKey: () => [], queryOptions: () => ({ queryKey: [], queryFn: () => [] }) },
        getByIdForBooking: { queryKey: () => [], queryOptions: () => ({ queryKey: [], queryFn: () => [] }) },
      },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <ManageBookingPageClient
          timeslot={lesson}
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
    const lesson = createMockTimeslot({ hasPaymentMethods: true })
    ;(lesson.eventType as any).paymentMethods.allowedDropIn.adjustable = true
    const PaymentMethodsStub = () => <div data-testid="payment-methods-stub">Payment methods</div>
    let serverBookings = [createMockBooking(1, 'confirmed')]
    const newPendingBooking = createMockBooking(101, 'pending')
    mockCreateBookings.mockImplementation(async () => {
      serverBookings = [...serverBookings, newPendingBooking]
      return [newPendingBooking]
    })

    ;(useTRPC as any).mockReturnValue({
      bookings: {
        getUserBookingsForTimeslot: {
          queryKey: (opts: { timeslotId: number }) => ['bookings', 'getUserBookingsForTimeslot', opts],
          queryOptions: (opts: { timeslotId: number }) => ({
            queryKey: ['bookings', 'getUserBookingsForTimeslot', opts],
            queryFn: () => serverBookings,
            initialData: serverBookings,
          }),
        },
        cancelBooking: { mutationOptions: () => ({ mutationFn: mockCancelBooking }) },
        createBookings: { mutationOptions: (opts?: { onSuccess?: () => void; onError?: (e: any) => void }) => ({ mutationFn: mockCreateBookings, onSuccess: opts?.onSuccess, onError: opts?.onError }) },
        setMyBookingQuantityForTimeslot: { mutationOptions: () => ({ mutationFn: mockSetBookingQuantity }) },
        cancelPendingBookingsForTimeslot: { mutationOptions: () => ({ mutationFn: mockCancelPendingBookingsForTimeslot }) },
      },
      timeslots: {
        getByDate: { queryKey: () => [], queryOptions: () => ({ queryKey: [], queryFn: () => [] }) },
        getById: { queryKey: () => [], queryOptions: () => ({ queryKey: [], queryFn: () => [] }) },
        getByIdForBooking: { queryKey: () => [], queryOptions: () => ({ queryKey: [], queryFn: () => [] }) },
      },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <ManageBookingPageClient timeslot={lesson} initialBookings={serverBookings} PaymentMethodsComponent={PaymentMethodsStub} />
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
      timeslotId: 1,
      quantity: 1,
      status: 'pending',
    })
    expect(mockCancelPendingBookingsForTimeslot).not.toHaveBeenCalled()
    expect(screen.getByTestId('pending-booking-quantity')).toHaveTextContent('1')
  })

  it('applies checkout quantity changes immediately when user clicks plus or minus', async () => {
    const lesson = createMockTimeslot({ hasPaymentMethods: true })
    ;(lesson.eventType as any).paymentMethods.allowedDropIn.adjustable = true
    const PaymentMethodsStub = () => <div data-testid="payment-methods-stub">Payment methods</div>
    const confirmedBooking = createMockBooking(1, 'confirmed')
    const pendingBookings = [createMockBooking(101, 'pending')]
    const addedPendingBooking = createMockBooking(102, 'pending')
    let serverBookings = [confirmedBooking, ...pendingBookings]

    mockCreateBookings.mockImplementation(async () => {
      serverBookings = [...serverBookings, addedPendingBooking]
      return [addedPendingBooking]
    })
    mockCancelBooking.mockImplementation(async ({ id }: { id: number }) => {
      serverBookings = serverBookings.filter((booking) => booking.id !== id)
      return {}
    })

    ;(useTRPC as any).mockReturnValue({
      bookings: {
        getUserBookingsForTimeslot: {
          queryKey: (opts: { timeslotId: number }) => ['bookings', 'getUserBookingsForTimeslot', opts],
          queryOptions: (opts: { timeslotId: number }) => ({
            queryKey: ['bookings', 'getUserBookingsForTimeslot', opts],
            queryFn: () => serverBookings,
            initialData: serverBookings,
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
        setMyBookingQuantityForTimeslot: { mutationOptions: () => ({ mutationFn: mockSetBookingQuantity }) },
        cancelPendingBookingsForTimeslot: { mutationOptions: () => ({ mutationFn: mockCancelPendingBookingsForTimeslot }) },
      },
      timeslots: {
        getByDate: { queryKey: () => [], queryOptions: () => ({ queryKey: [], queryFn: () => [] }) },
        getById: { queryKey: () => [], queryOptions: () => ({ queryKey: [], queryFn: () => [] }) },
        getByIdForBooking: { queryKey: () => [], queryOptions: () => ({ queryKey: [], queryFn: () => [] }) },
      },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <ManageBookingPageClient
          timeslot={lesson}
          initialBookings={serverBookings}
          PaymentMethodsComponent={PaymentMethodsStub}
        />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('Complete Payment')).toBeInTheDocument()
    })

    expect(screen.queryByRole('button', { name: /update quantity/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Increase new bookings'))

    await waitFor(() => {
      expect(mockCreateBookings.mock.calls[0]?.[0]).toEqual({
        timeslotId: 1,
        quantity: 1,
        status: 'pending',
      })
    })
    await waitFor(() => {
      expect(screen.getByTestId('pending-booking-quantity')).toHaveTextContent('2')
    })

    fireEvent.click(screen.getByLabelText('Decrease new bookings'))

    await waitFor(() => {
      expect(mockCancelBooking).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(screen.getByTestId('pending-booking-quantity')).toHaveTextContent('1')
    })
  })

  it('cancels pending bookings when the checkout flow unmounts', async () => {
    const lesson = createMockTimeslot({ hasPaymentMethods: true })
    const PaymentMethodsStub = () => <div data-testid="payment-methods-stub">Payment methods</div>
    const pendingBookings = [createMockBooking(101, 'pending')]

    const { unmount } = render(
      <QueryClientProvider client={queryClient}>
        <ManageBookingPageClient timeslot={lesson} initialBookings={pendingBookings} PaymentMethodsComponent={PaymentMethodsStub} />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('Complete Payment')).toBeInTheDocument()
    })

    unmount()

    await waitFor(() => {
      expect(mockCancelPendingBookingsForTimeslot).toHaveBeenCalled()
    })
    expect(mockCancelPendingBookingsForTimeslot.mock.calls[0]?.[0]).toEqual({ timeslotId: 1 })
  })
})
