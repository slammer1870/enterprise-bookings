import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PaymentMethods } from '../../../../payments/payments-next/src/components/payment-methods'

const { useQueryMock } = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => ({ get: () => null }),
  usePathname: () => '/bookings/42',
  useParams: () => ({ id: '42' }),
}))

vi.mock('@repo/trpc/client', () => ({
  useTRPC: () => ({
    subscriptions: {
      getSubscriptionForTimeslot: {
        queryOptions: () => ({ queryKey: ['subscriptions.getSubscriptionForTimeslot'] }),
      },
    },
    bookings: {
      getValidCourseEnrollmentsForTimeslot: {
        queryOptions: () => ({ queryKey: ['bookings.getValidCourseEnrollmentsForTimeslot'] }),
      },
      getValidClassPassesForTimeslot: {
        queryOptions: () => ({ queryKey: ['bookings.getValidClassPassesForTimeslot'] }),
      },
      getPurchasableClassPassTypesForTimeslot: {
        queryOptions: () => ({ queryKey: ['bookings.getPurchasableClassPassTypesForTimeslot'] }),
      },
      createBookings: {
        mutationOptions: () => ({}),
      },
    },
    payments: {
      getSubscriptionFeeBreakdown: {
        queryOptions: () => ({ queryKey: ['payments.getSubscriptionFeeBreakdown'] }),
      },
      createCustomerCheckoutSession: {
        mutationOptions: (options?: object) => options ?? {},
      },
      createCustomerPortal: {
        mutationOptions: (options?: object) => options ?? {},
      },
      createCustomerUpgradePortal: {
        mutationOptions: (options?: object) => options ?? {},
      },
    },
  }),
}))

vi.mock('@tanstack/react-query', () => ({
  keepPreviousData: (previousData: unknown) => previousData,
  useQuery: useQueryMock,
  useMutation: vi.fn(() => ({ mutateAsync: vi.fn() })),
}))

const now = new Date()
const dayOffset = (days: number) => {
  const date = new Date(now)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

const timeslotStart = (() => {
  const date = new Date(now)
  date.setUTCDate(date.getUTCDate() + 14)
  date.setUTCHours(10, 0, 0, 0)
  return date.toISOString()
})()

function timeslotWithCourses(courses: object[]) {
  return {
    id: 42,
    startTime: timeslotStart,
    tenant: 9,
    bookingStatus: 'open',
    eventType: {
      id: 10,
      name: 'Morning Flow',
      paymentMethods: {
        allowedDropIn: {
          id: 1,
          name: 'Drop-in',
          isActive: true,
          price: 15,
          priceType: 'normal',
          discountTiers: [],
        },
        allowedCourses: courses,
      },
    },
  } as any
}

const closedCourse = {
  id: 3,
  title: 'Winter Course',
  status: 'closed',
  startDate: dayOffset(5),
  endDate: dayOffset(40),
  priceInformation: { price: 99 },
  allowedEventTypes: [10],
}

const openCourse = {
  ...closedCourse,
  status: 'open',
}

const settledSubscription = {
  data: {
    subscription: null,
    subscriptionLimitReached: false,
    remainingSessions: null,
    needsCustomerPortal: false,
    upgradeOptions: [],
    eligiblePlansForQuantity: null,
    confirmedForTimeslot: 0,
  },
  isLoading: false,
  isFetching: false,
}

function setupQuery(enrollments: object[] = []) {
  useQueryMock.mockImplementation((query: { queryKey?: string[] }) => {
    const key = query?.queryKey?.[0]
    switch (key) {
      case 'subscriptions.getSubscriptionForTimeslot':
        return settledSubscription
      case 'bookings.getValidCourseEnrollmentsForTimeslot':
        return { data: enrollments, isLoading: false, isFetching: false }
      case 'bookings.getValidClassPassesForTimeslot':
        return { data: [], isLoading: false, isFetching: false }
      case 'bookings.getPurchasableClassPassTypesForTimeslot':
        return { data: [], isLoading: false, isFetching: false }
      default:
        return { data: undefined, isLoading: false, isFetching: false }
    }
  })
}

describe('PaymentMethods – course tab only when a course is available', () => {
  beforeEach(() => {
    useQueryMock.mockReset()
  })

  it('hides the course tab when the linked course is not open', () => {
    setupQuery()
    render(<PaymentMethods timeslot={timeslotWithCourses([closedCourse])} />)

    expect(screen.getByRole('tab', { name: /drop-in/i })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /^course$/i })).not.toBeInTheDocument()
  })

  it('hides the course tab when the course does not cover this class', () => {
    setupQuery()
    render(
      <PaymentMethods
        timeslot={timeslotWithCourses([{ ...openCourse, allowedEventTypes: [99] }])}
      />,
    )

    expect(screen.queryByRole('tab', { name: /^course$/i })).not.toBeInTheDocument()
  })

  it('shows the course tab when an open course covers this timeslot', () => {
    setupQuery()
    render(<PaymentMethods timeslot={timeslotWithCourses([openCourse])} />)

    expect(screen.getByRole('tab', { name: /^course$/i })).toBeInTheDocument()
  })

  it('shows the course tab when the viewer already has a usable enrollment', () => {
    setupQuery([{ id: 8, course: { id: 3, title: 'Winter Course' } }])
    render(<PaymentMethods timeslot={timeslotWithCourses([closedCourse])} />)

    expect(screen.getByRole('tab', { name: /^course$/i })).toBeInTheDocument()
  })

  it('hides the course tab when quantity is more than one', () => {
    setupQuery([{ id: 8, course: { id: 3, title: 'Winter Course' } }])
    render(<PaymentMethods timeslot={timeslotWithCourses([openCourse])} quantity={2} />)

    expect(screen.queryByRole('tab', { name: /^course$/i })).not.toBeInTheDocument()
  })
})
