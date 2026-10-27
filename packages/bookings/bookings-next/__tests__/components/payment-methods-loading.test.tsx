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
  useQuery: useQueryMock,
  useMutation: vi.fn(() => ({ mutateAsync: vi.fn() })),
}))

/** Class option whose only configured method is a class pass. */
const classPassOnlyTimeslot = {
  id: 42,
  startTime: '2026-04-07T10:00:00.000Z',
  tenant: 9,
  bookingStatus: 'open',
  eventType: {
    name: 'Morning Flow',
    paymentMethods: {
      allowedClassPasses: [{ id: 7, name: '10 Class Pass' }],
    },
  },
} as any

const dropInTimeslot = {
  ...classPassOnlyTimeslot,
  eventType: {
    paymentMethods: {
      allowedDropIn: {
        id: 1,
        name: 'Drop-in',
        isActive: true,
        price: 15,
        priceType: 'normal',
        discountTiers: [],
      },
    },
  },
} as any

const settledEmpty = { data: [], isLoading: false, isFetching: false }
const stillLoading = { data: undefined, isLoading: true, isFetching: true }

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
}

type QueryOverrides = {
  classPasses?: object
  purchasable?: object
  courses?: object
  subscription?: object
}

function setupQuery(overrides: QueryOverrides = {}) {
  useQueryMock.mockImplementation((query: { queryKey?: string[] }) => {
    const key = query?.queryKey?.[0]
    switch (key) {
      case 'subscriptions.getSubscriptionForTimeslot':
        return overrides.subscription ?? settledSubscription
      case 'bookings.getValidCourseEnrollmentsForTimeslot':
        return overrides.courses ?? settledEmpty
      case 'bookings.getValidClassPassesForTimeslot':
        return overrides.classPasses ?? settledEmpty
      case 'bookings.getPurchasableClassPassTypesForTimeslot':
        return overrides.purchasable ?? settledEmpty
      default:
        return { data: undefined, isLoading: false }
    }
  })
}

describe('PaymentMethods – loading before async payment options resolve', () => {
  beforeEach(() => {
    useQueryMock.mockReset()
  })

  it('shows loading instead of the empty state while class passes are still loading', () => {
    setupQuery({
      classPasses: stillLoading,
      purchasable: stillLoading,
    })

    render(<PaymentMethods timeslot={classPassOnlyTimeslot} />)

    expect(screen.getByText(/loading payment methods/i)).toBeInTheDocument()
    expect(screen.queryByText(/no payment methods are available/i)).not.toBeInTheDocument()
  })

  it('keeps loading while course enrollments are still loading and nothing else is available', () => {
    setupQuery({ courses: stillLoading })

    render(<PaymentMethods timeslot={classPassOnlyTimeslot} />)

    expect(screen.getByText(/loading payment methods/i)).toBeInTheDocument()
    expect(screen.queryByText(/no payment methods are available/i)).not.toBeInTheDocument()
  })

  it('keeps loading while membership data is still loading and nothing else is available', () => {
    setupQuery({ subscription: { ...settledSubscription, isLoading: true } })

    render(<PaymentMethods timeslot={classPassOnlyTimeslot} />)

    expect(screen.getByText(/loading payment methods/i)).toBeInTheDocument()
    expect(screen.queryByText(/no payment methods are available/i)).not.toBeInTheDocument()
  })

  it('keeps loading while class passes are refetching', () => {
    setupQuery({
      classPasses: { data: [], isLoading: false, isFetching: true },
      purchasable: { data: [], isLoading: false, isFetching: false },
    })

    render(<PaymentMethods timeslot={classPassOnlyTimeslot} />)

    expect(screen.getByText(/loading payment methods/i)).toBeInTheDocument()
    expect(screen.queryByText(/no payment methods are available/i)).not.toBeInTheDocument()
  })

  it('shows the empty state only after every payment option query has settled with nothing', () => {
    setupQuery()

    render(<PaymentMethods timeslot={classPassOnlyTimeslot} />)

    expect(screen.getByText(/no payment methods are available for this timeslot/i)).toBeInTheDocument()
    expect(screen.queryByText(/loading payment methods/i)).not.toBeInTheDocument()
  })

  it('shows the class pass tab once a purchasable pass has loaded', () => {
    setupQuery({
      purchasable: {
        data: [{ id: 7, name: '10 Class Pass', quantity: 10, priceId: 'price_pass' }],
        isLoading: false,
        isFetching: false,
      },
    })

    render(<PaymentMethods timeslot={classPassOnlyTimeslot} />)

    expect(screen.getByRole('tab', { name: /class pass/i })).toBeInTheDocument()
    expect(screen.queryByText(/no payment methods are available/i)).not.toBeInTheDocument()
  })

  it('shows an already-known method immediately while class passes are still loading', () => {
    setupQuery({
      classPasses: stillLoading,
      purchasable: stillLoading,
    })

    render(<PaymentMethods timeslot={dropInTimeslot} />)

    expect(screen.getByRole('tab', { name: /drop-in/i })).toBeInTheDocument()
    expect(screen.queryByText(/loading payment methods/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/no payment methods are available/i)).not.toBeInTheDocument()
  })
})
