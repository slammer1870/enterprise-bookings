import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PaymentMethods } from '../../../../payments/payments-next/src/components/payment-methods'

const { pushMock, createCheckoutSessionMock, useQueryMock, searchDiscountCodeMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  createCheckoutSessionMock: vi.fn(),
  useQueryMock: vi.fn(),
  searchDiscountCodeMock: { current: 'SAVE20' as string | null },
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => ({
    get: (key: string) => (key === 'discount' ? searchDiscountCodeMock.current : null),
  }),
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
  useMutation: vi.fn((options?: { onSuccess?: (_data: { url: string | null }) => void }) => {
    if (options?.onSuccess) {
      return {
        mutateAsync: async (variables: unknown) => {
          createCheckoutSessionMock(variables)
          return { url: 'https://checkout.example/session' }
        },
      }
    }
    return {
      mutateAsync: vi.fn(),
    }
  }),
}))

describe('PaymentMethods discount forwarding', () => {
  beforeEach(() => {
    pushMock.mockReset()
    createCheckoutSessionMock.mockReset()
    searchDiscountCodeMock.current = 'SAVE20'
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ valid: true, discountCode: 'SAVE20' }),
      }))
    )
    useQueryMock.mockImplementation((query: { queryKey?: string[]; enabled?: boolean }) => {
      const key = query?.queryKey?.[0]
      switch (key) {
        case 'subscriptions.getSubscriptionForTimeslot':
          return {
            data: {
              subscription: null,
              subscriptionLimitReached: false,
              remainingSessions: null,
              needsCustomerPortal: false,
              upgradeOptions: [],
              eligiblePlansForQuantity: null,
            },
            isLoading: false,
          }
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
  })

  it('forwards discount code from search params to membership checkout', async () => {
    const timeslot = {
      id: 42,
      startTime: '2026-04-07T10:00:00.000Z',
      tenant: 9,
      bookingStatus: 'open',
      eventType: {
        paymentMethods: {
          allowedPlans: [
            {
              id: 1,
              name: 'Unlimited',
              status: 'active',
              priceJSON: JSON.stringify({
                id: 'price_plan_123',
                unit_amount: 4900,
                currency: 'EUR',
                type: 'recurring',
                recurring: {
                  interval: 'month',
                  interval_count: 1,
                },
              }),
            },
          ],
        },
      },
    } as any

    render(<PaymentMethods timeslot={timeslot} />)

    await userEvent.click(screen.getByRole('button', { name: /subscribe/i }))

    await waitFor(() => {
      expect(createCheckoutSessionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          priceId: 'price_plan_123',
          mode: 'subscription',
          discountCode: 'SAVE20',
          metadata: expect.objectContaining({
            timeslotId: '42',
            tenantId: '9',
          }),
        }),
      )
    })
  })

  it('validates a customer-entered discount code before using it for checkout', async () => {
    searchDiscountCodeMock.current = null

    const timeslot = {
      id: 42,
      startTime: '2026-04-07T10:00:00.000Z',
      tenant: 9,
      bookingStatus: 'open',
      eventType: {
        paymentMethods: {
          allowedDropIn: {
            id: 1,
            name: 'Test drop-in',
            isActive: true,
            price: 10,
            priceType: 'normal',
            paymentMethods: ['card'],
            discountTiers: [],
            updatedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          },
          allowedPlans: [
            {
              id: 1,
              name: 'Unlimited',
              status: 'active',
              priceJSON: JSON.stringify({
                id: 'price_plan_123',
                unit_amount: 4900,
                currency: 'EUR',
                type: 'recurring',
                recurring: {
                  interval: 'month',
                  interval_count: 1,
                },
              }),
            },
          ],
        },
      },
    } as any

    render(
      <PaymentMethods
        timeslot={timeslot}
        validateDiscountCodeUrl="/api/stripe/connect/validate-discount-code"
      />
    )

    await userEvent.click(screen.getByRole('tab', { name: /drop-in/i }))
    await userEvent.type(screen.getByLabelText(/promo code/i), 'save20')
    await userEvent.click(screen.getByRole('button', { name: /^apply$/i }))

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/stripe/connect/validate-discount-code',
      expect.objectContaining({
        method: 'POST',
      }),
    )
    expect(await screen.findByText(/promo code applied/i)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('tab', { name: /membership/i }))
    await userEvent.click(screen.getByRole('button', { name: /subscribe/i }))

    await waitFor(() => {
      expect(createCheckoutSessionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          priceId: 'price_plan_123',
          discountCode: 'SAVE20',
        }),
      )
    })
  })

  it('shows an error and does not use invalid customer-entered discount codes', async () => {
    searchDiscountCodeMock.current = null
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        json: async () => ({ error: 'Invalid or inactive discount code.' }),
      }))
    )

    const timeslot = {
      id: 42,
      startTime: '2026-04-07T10:00:00.000Z',
      tenant: 9,
      bookingStatus: 'open',
      eventType: {
        paymentMethods: {
          allowedDropIn: {
            id: 1,
            name: 'Test drop-in',
            isActive: true,
            price: 10,
            priceType: 'normal',
            paymentMethods: ['card'],
            discountTiers: [],
            updatedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          },
          allowedPlans: [
            {
              id: 1,
              name: 'Unlimited',
              status: 'active',
              priceJSON: JSON.stringify({
                id: 'price_plan_123',
                unit_amount: 4900,
                currency: 'EUR',
                type: 'recurring',
                recurring: {
                  interval: 'month',
                  interval_count: 1,
                },
              }),
            },
          ],
        },
      },
    } as any

    render(
      <PaymentMethods
        timeslot={timeslot}
        validateDiscountCodeUrl="/api/stripe/connect/validate-discount-code"
      />
    )

    await userEvent.click(screen.getByRole('tab', { name: /drop-in/i }))
    await userEvent.type(screen.getByLabelText(/promo code/i), 'notreal')
    await userEvent.click(screen.getByRole('button', { name: /^apply$/i }))

    expect(await screen.findByText(/invalid or inactive discount code/i)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('tab', { name: /membership/i }))
    await userEvent.click(screen.getByRole('button', { name: /subscribe/i }))

    await waitFor(() => {
      expect(createCheckoutSessionMock).toHaveBeenCalledWith(
        expect.not.objectContaining({
          discountCode: expect.anything(),
        }),
      )
    })
  })

  it('forwards discount code from search params to class pass checkout', async () => {
    useQueryMock.mockImplementation((query: { queryKey?: string[]; enabled?: boolean }) => {
      const key = query?.queryKey?.[0]
      switch (key) {
        case 'subscriptions.getSubscriptionForTimeslot':
          return {
            data: {
              subscription: null,
              subscriptionLimitReached: false,
              remainingSessions: null,
              needsCustomerPortal: false,
              upgradeOptions: [],
              eligiblePlansForQuantity: null,
            },
            isLoading: false,
          }
        case 'bookings.getValidClassPassesForTimeslot':
          return { data: [], isLoading: false }
        case 'bookings.getPurchasableClassPassTypesForTimeslot':
          return {
            data: [
              {
                id: 22,
                name: '5 Class Pass',
                quantity: 5,
                priceId: 'price_pass_456',
              },
            ],
            isLoading: false,
          }
        case 'payments.getSubscriptionFeeBreakdown':
          return { data: undefined, isLoading: false }
        default:
          return { data: undefined, isLoading: false }
      }
    })

    const timeslot = {
      id: 42,
      startTime: '2026-04-07T10:00:00.000Z',
      tenant: 9,
      bookingStatus: 'open',
      eventType: {
        paymentMethods: {
          allowedPlans: [],
          allowedClassPasses: [22],
        },
      },
    } as any

    render(<PaymentMethods timeslot={timeslot} />)

    await userEvent.click(screen.getByRole('tab', { name: /class pass/i }))
    await userEvent.click(screen.getByRole('button', { name: /buy pass/i }))

    await waitFor(() => {
      expect(createCheckoutSessionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          priceId: 'price_pass_456',
          mode: 'payment',
          discountCode: 'SAVE20',
          metadata: expect.objectContaining({
            type: 'class_pass_purchase',
            classPassTypeId: '22',
            timeslotId: '42',
            tenantId: '9',
          }),
        }),
      )
    })
  })
})
