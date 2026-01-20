import { getSession } from '@/lib/auth/context/get-context-props'
import { createCaller } from '@/trpc/server'
import { createBookingPage, type BookingPageConfig } from '@repo/bookings-next'

// Route params are always strings in Next.js App Router
type BookingPageProps = {
  params: Promise<{ id: string }>
}

const bookingPageConfig: BookingPageConfig = {
  getSession: async () => {
    const session = await getSession()
    return session ? { user: session.user } : null
  },
  createCaller,
  authRedirectPath: (id) => `/complete-booking?mode=login&callbackUrl=/bookings/${id}`,
  errorRedirectPath: '/',
  onSuccessRedirect: '/',
  // MVP: Don't attempt check-in, always show booking page
  attemptCheckIn: false,
}

export default async function BookingPage({ params }: BookingPageProps) {
  const { id } = await params
  return createBookingPage(id, bookingPageConfig)
}
