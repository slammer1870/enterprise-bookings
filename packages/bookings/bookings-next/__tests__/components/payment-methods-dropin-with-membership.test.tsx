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

// Timeslot that has both drop-in and a membership plan configured
const makeTimeslot = (planId = 10) =>
  ({
    id: 42,
    startTime: '2026-04-07T10:00:00.000Z',
    tenant: 9,
    bookingStatus: 'open',
    eventType: {
      paymentMethods: {
        allowedDropIn: {
          id: 1,
          name: 'Drop-in',
          isActive: true,
          price: 15,
          priceType: 'normal',
          discountTiers: [],
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        },
        allowedPlans: [
          {
            id: planId,
            name: 'Single-slot Membership',
            status: 'active',
            sessionsInformation: { maxBookingsPerTimeslot: 1 },
            priceJSON: JSON.stringify({
              id: 'price_plan_123',
              unit_amount: 4900,
              currency: 'EUR',
              type: 'recurring',
              recurring: { interval: 'month', interval_count: 1 },
            }),
          },
        ],
      },
    },
  }) as any

const makeSubscriptionQuery = (
  subscriptionOverride: object | null,
  opts: { subscriptionLimitReached?: boolean; remainingSessions?: number | null } = {}
) => ({
  data: {
    subscription: subscriptionOverride,
    subscriptionLimitReached: opts.subscriptionLimitReached ?? false,
    remainingSessions: opts.remainingSessions ?? null,
    needsCustomerPortal: false,
    upgradeOptions: [],
    eligiblePlansForQuantity: null,
  },
  isLoading: false,
})

const defaultNoSubscription = makeSubscriptionQuery(null)

const activeSubscription = (maxBookingsPerTimeslot: number | null) =>
  makeSubscriptionQuery({
    id: 1,
    status: 'active',
    plan: {
      id: 10,
      sessionsInformation: { maxBookingsPerTimeslot },
    },
  })

function setupQuery(subscriptionData: ReturnType<typeof makeSubscriptionQuery>) {
  useQueryMock.mockImplementation((query: { queryKey?: string[] }) => {
    const key = query?.queryKey?.[0]
    switch (key) {
      case 'subscriptions.getSubscriptionForTimeslot':
        return subscriptionData
      case 'bookings.getValidClassPassesForTimeslot':
        return { data: [], isLoading: false }
      case 'bookings.getPurchasableClassPassTypesForTimeslot':
        return { data: [], isLoading: false }
      case 'payments.getSubscriptionFeeBreakdown':
        return { data: undefined, isLoading: false }
      default:
        return { data: undefined, isLoading: false }
    }
  })
}

describe('PaymentMethods – drop-in visibility alongside membership', () => {
  beforeEach(() => {
    useQueryMock.mockReset()
  })

  it('shows drop-in tab when user has no membership', () => {
    setupQuery(defaultNoSubscription)
    render(<PaymentMethods timeslot={makeTimeslot()} />)
    expect(screen.getByRole('tab', { name: /drop-in/i })).toBeInTheDocument()
  })

  it('shows drop-in tab when user has an active membership capped at 1 per timeslot', () => {
    // The user's one slot was already booked via membership; drop-in should be
    // available so they can pay for an additional slot.
    setupQuery(activeSubscription(1))
    render(<PaymentMethods timeslot={makeTimeslot()} quantity={1} />)
    expect(screen.getByRole('tab', { name: /drop-in/i })).toBeInTheDocument()
  })

  it('shows drop-in tab when plan uses legacy single-slot flag (maxBookingsPerTimeslot null, allowMultiple false)', () => {
    // Legacy plans stored `allowMultipleBookingsPerTimeslot: false` instead of
    // maxBookingsPerTimeslot. They are equivalent to maxBookingsPerTimeslot: 1.
    setupQuery(
      makeSubscriptionQuery({
        id: 1,
        status: 'active',
        plan: {
          id: 10,
          sessionsInformation: { maxBookingsPerTimeslot: null, allowMultipleBookingsPerTimeslot: false },
        },
      })
    )
    render(<PaymentMethods timeslot={makeTimeslot()} quantity={1} />)
    expect(screen.getByRole('tab', { name: /drop-in/i })).toBeInTheDocument()
  })

  it('hides drop-in tab when user has an active membership that allows 2+ bookings per timeslot (quantity 1)', () => {
    // Membership can still cover this extra slot – no need to show drop-in.
    setupQuery(
      makeSubscriptionQuery({
        id: 1,
        status: 'active',
        plan: {
          id: 10,
          sessionsInformation: { maxBookingsPerTimeslot: 2 },
        },
      })
    )
    render(<PaymentMethods timeslot={makeTimeslot()} quantity={1} />)
    expect(screen.queryByRole('tab', { name: /drop-in/i })).not.toBeInTheDocument()
  })

  it('hides drop-in tab when user has an unlimited membership (maxBookingsPerTimeslot null, allowMultiple true)', () => {
    setupQuery(
      makeSubscriptionQuery({
        id: 1,
        status: 'active',
        plan: {
          id: 10,
          sessionsInformation: { maxBookingsPerTimeslot: null, allowMultipleBookingsPerTimeslot: true },
        },
      })
    )
    render(<PaymentMethods timeslot={makeTimeslot()} quantity={1} />)
    expect(screen.queryByRole('tab', { name: /drop-in/i })).not.toBeInTheDocument()
  })

  it('hides drop-in tab when membership is trialing and plan allows multiple (quantity 1)', () => {
    setupQuery(
      makeSubscriptionQuery({
        id: 1,
        status: 'trialing',
        plan: {
          id: 10,
          sessionsInformation: { maxBookingsPerTimeslot: 2 },
        },
      })
    )
    render(<PaymentMethods timeslot={makeTimeslot()} quantity={1} />)
    expect(screen.queryByRole('tab', { name: /drop-in/i })).not.toBeInTheDocument()
  })

  it('shows drop-in tab when membership is trialing but plan is capped at 1 per timeslot', () => {
    setupQuery(
      makeSubscriptionQuery({
        id: 1,
        status: 'trialing',
        plan: {
          id: 10,
          sessionsInformation: { maxBookingsPerTimeslot: 1 },
        },
      })
    )
    render(<PaymentMethods timeslot={makeTimeslot()} quantity={1} />)
    expect(screen.getByRole('tab', { name: /drop-in/i })).toBeInTheDocument()
  })

  it('shows drop-in tab when membership is past_due (not usable)', () => {
    // past_due memberships are not "usable" so drop-in should show regardless of plan cap.
    setupQuery(
      makeSubscriptionQuery({
        id: 1,
        status: 'past_due',
        plan: {
          id: 10,
          sessionsInformation: { maxBookingsPerTimeslot: 2 },
        },
      })
    )
    render(<PaymentMethods timeslot={makeTimeslot()} quantity={1} />)
    expect(screen.getByRole('tab', { name: /drop-in/i })).toBeInTheDocument()
  })
})
