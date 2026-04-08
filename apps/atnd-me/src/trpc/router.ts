import { createAppRouter } from '@repo/trpc'
import { calculateBookingFeeAmount } from '@/lib/stripe-connect/bookingFee'

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
      lessonId,
      classPriceCents,
      originalClassPriceCents,
      promoDiscountCents,
    }) => {
      const lesson = (await payload.findByID({
        collection: 'lessons',
        id: lessonId,
        depth: 0,
        overrideAccess: true,
        select: { tenant: true } as any,
      })) as { tenant?: number | { id: number } } | null
      const tenantId =
        lesson?.tenant != null
          ? typeof lesson.tenant === 'object' && lesson.tenant !== null
            ? lesson.tenant.id
            : lesson.tenant
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
