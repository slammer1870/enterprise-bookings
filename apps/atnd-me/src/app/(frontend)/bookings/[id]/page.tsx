import { getSession } from '@/lib/auth/context/get-context-props'
import { createCaller } from '@/trpc/server'
import { headers as nextHeaders } from 'next/headers'
import { createBookingPage, BookingPageClientSmart, type BookingPageConfig } from '@repo/bookings-next'
import { PaymentMethodsConnect } from '@/components/payments/PaymentMethodsConnect.client'

// Uses getSession()/headers() and createCaller()/cookies(); must be dynamic in production.
export const dynamic = 'force-dynamic'

// Route params are always strings in Next.js App Router
type BookingPageProps = {
  params: Promise<{ id: string }>
}

const bookingPageConfig: BookingPageConfig = {
  getSession: async () => {
    const session = await getSession()
    return session ? { user: session.user } : null
  },
  getRequestHost: async () => {
    const h = await nextHeaders()
    const host = h.get('host') ?? h.get('x-forwarded-host') ?? ''
    if (host) return host
    // Fallback: derive host from Referer when Host is missing (e.g. some RSC/proxy contexts).
    const referer = h.get('referer')
    if (referer) {
      try {
        return new URL(referer).host
      } catch {
        // ignore
        console.error('Failed to derive host from referer', referer)
      }
    }
    return ''
  },
  createCaller,
  authRedirectPath: (id) => `/complete-booking?mode=login&callbackUrl=/bookings/${id}`,
  errorRedirectPath: '/',
  onSuccessRedirect: '/',
  // Show checkout (Drop-in / Membership tabs) when payment methods are attached
  BookingPageClient: (props) => (
    <BookingPageClientSmart {...props} PaymentMethodsComponent={PaymentMethodsConnect} />
  ),
  // MVP: Don't attempt check-in, always show booking page
  attemptCheckIn: false,
  // Redirect to manage page if user has multiple bookings
  postValidation: async (lesson, user, caller) => {
    if (!user) return null

    try {
      const userBookings = await caller.bookings.getUserBookingsForLesson({ lessonId: lesson.id })
      const bookingCount = Array.isArray(userBookings) ? userBookings.length : 0
      if (bookingCount >= 2) return `/bookings/${lesson.id}/manage`
      return null
    } catch (err) {
      // Don't crash the whole page: log and proceed so user can still see the booking form.
      // Common in e2e when tenant context (cookie/host) isn't ready yet.
      console.error('[bookings postValidation] getUserBookingsForLesson failed:', err)
      return null
    }
  },
}

export default async function BookingPage({ params }: BookingPageProps) {
  const { id } = await params
  return createBookingPage(id, bookingPageConfig)
}
