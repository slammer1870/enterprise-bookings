import { createAppRouter } from '@repo/trpc'
import { calculateBookingFeeAmount } from '@/lib/stripe-connect/bookingFee'
import { ATND_ME_BOOKINGS_COLLECTION_SLUGS } from '@/constants/bookings-collection-slugs'

/**
 * App router with subscription + drop-in booking fee support.
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
    getDropInFeeBreakdown: async ({
      payload,
      timeslotId,
      classPriceCents,
      originalClassPriceCents,
      promoDiscountCents,
    }) => {
      const timeslot = (await payload.findByID({
        collection: ATND_ME_BOOKINGS_COLLECTION_SLUGS.timeslots,
        id: timeslotId,
        depth: 0,
        overrideAccess: true,
        select: { tenant: true } as any,
      })) as { tenant?: number | { id: number } } | null
      const tenantId =
        timeslot?.tenant != null
          ? typeof timeslot.tenant === 'object' && timeslot.tenant !== null
            ? timeslot.tenant.id
            : timeslot.tenant
          : null
      if (!tenantId) {
        return {
          classPriceCents,
          originalClassPriceCents,
          promoDiscountCents,
          bookingFeeCents: 0,
          totalCents: classPriceCents,
        }
      }
      const bookingFeeCents = await calculateBookingFeeAmount({
        payload,
        tenantId,
        productType: 'drop-in',
        classPriceAmount: classPriceCents,
      })
      return {
        classPriceCents,
        originalClassPriceCents,
        promoDiscountCents,
        bookingFeeCents,
        totalCents: classPriceCents + bookingFeeCents,
      }
    },
  },
})

export type AppRouter = typeof appRouter
