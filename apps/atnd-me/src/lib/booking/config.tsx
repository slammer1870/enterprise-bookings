import { createBookingPage, BookingPageClientSmart, type BookingPageConfig } from '@repo/bookings-next'
import { PaymentMethodsConnect } from '@/components/payments/PaymentMethodsConnect.client'
import { getSession } from '@/lib/auth/context/get-context-props'
import { createCaller } from '@/trpc/server'
import { getRequestHost, redirectToManageIfMultipleBookings } from './utils'

export const bookingPageConfig: BookingPageConfig = {
  getSession: async () => {
    const session = await getSession()
    return session ? { user: session.user } : null
  },
  getRequestHost,
  createCaller,
  authRedirectPath: (id) => `/complete-booking?mode=login&callbackUrl=/bookings/${id}`,
  errorRedirectPath: '/',
  onSuccessRedirect: '/success',
  BookingPageClient: (props) => (
    <BookingPageClientSmart {...props} PaymentMethodsComponent={PaymentMethodsConnect} />
  ),
  attemptCheckIn: false,
  postValidation: redirectToManageIfMultipleBookings,
}

export { createBookingPage }
