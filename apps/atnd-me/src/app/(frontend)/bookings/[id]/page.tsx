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
  // Redirect to manage page if user has multiple bookings
  postValidation: async (lesson, user, caller) => {
    if (!user) return null
    
    // Fetch user bookings - if this fails, let the error propagate so we can debug it
    // Previously, errors were caught and swallowed, preventing redirects from working
    const userBookings = await caller.bookings.getUserBookingsForLesson({ lessonId: lesson.id })
    
    // Use explicit check to ensure we have a valid array and count
    const bookingCount = Array.isArray(userBookings) ? userBookings.length : 0
    
    // If user has 2+ bookings, redirect to manage page
    if (bookingCount >= 2) {
      return `/bookings/${lesson.id}/manage`
    }
    
    return null
  },
}

export default async function BookingPage({ params }: BookingPageProps) {
  const { id } = await params
  return createBookingPage(id, bookingPageConfig)
}
