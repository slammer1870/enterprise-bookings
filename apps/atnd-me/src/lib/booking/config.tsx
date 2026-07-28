import { createBookingPage, BookingPageClientSmart, type BookingPageConfig } from '@repo/bookings-next'
import { PaymentMethodsConnect } from '@/components/payments/PaymentMethodsConnect.client'
import { currentUser, getSession } from '@/lib/auth/context/get-context-props'
import { createCaller } from '@/trpc/server'
import { getRequestHost, redirectToManageIfMultipleBookings } from './utils'
import { getCheckoutLegalForTenant } from '@/lib/checkout/getCheckoutLegalForTenant'
import type { CheckoutLegalConfig } from '@repo/payments-next'
import type { Timeslot } from '@repo/shared-types'

async function getCheckoutLegal(timeslot: Timeslot): Promise<CheckoutLegalConfig | null> {
  const tenantId =
    timeslot.tenant != null && typeof timeslot.tenant === 'object'
      ? (timeslot.tenant as { id: number }).id
      : typeof timeslot.tenant === 'number'
        ? timeslot.tenant
        : null

  return getCheckoutLegalForTenant(tenantId)
}

async function BookingPageWithLegal({
  timeslot,
  onSuccessRedirect,
}: {
  timeslot: Timeslot
  onSuccessRedirect?: string
}) {
  const checkoutLegal = await getCheckoutLegal(timeslot)
  return (
    <BookingPageClientSmart
      timeslot={timeslot}
      onSuccessRedirect={onSuccessRedirect}
      PaymentMethodsComponent={PaymentMethodsConnect}
      useCheckoutHolds={true}
      releaseHoldApiUrl="/api/bookings/release-hold"
      cancelPendingApiUrl="/api/bookings/cancel-pending"
      checkoutLegal={checkoutLegal ?? undefined}
    />
  )
}

export const bookingPageConfig: BookingPageConfig = {
  getSession: async () => {
    const session = await getSession()
    // Better Auth `getSession` can return null on some hosts/cookie edges while
    // `payload.auth` still resolves the same cookies (same fallback as membership).
    if (session?.user) return { user: session.user }
    const user = await currentUser()
    return user ? { user } : null
  },
  getRequestHost,
  createCaller,
  authRedirectPath: (id) => `/complete-booking?mode=login&callbackUrl=/bookings/${id}`,
  errorRedirectPath: '/',
  onSuccessRedirect: '/success',
  BookingPageClient: BookingPageWithLegal,
  attemptCheckIn: true,
  postValidation: redirectToManageIfMultipleBookings,
}

export { createBookingPage }
