import { createAppRouter } from '@repo/trpc'
import { calculateBookingFeeAmount } from '@/lib/stripe-connect/bookingFee'

/**
 * App router with subscription booking fee support.
 * Used by API route, server.tsx, and tests that need payments.createCustomerCheckoutSession with fee.
 */
export const appRouter = createAppRouter({
  payments: {
    getSubscriptionBookingFeeCents: async ({
      payload,
      tenantId,
      classPriceAmountCents,
    }) =>
      calculateBookingFeeAmount({
        payload,
        tenantId,
        productType: 'subscription',
        classPriceAmount: classPriceAmountCents,
      }),
  },
})

export type AppRouter = typeof appRouter
