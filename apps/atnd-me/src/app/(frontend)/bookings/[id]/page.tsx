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
  postValidation: async (lesson, user) => {
    if (!user) return null
    
    const caller = await createCaller()
    try {
      const userBookings = await caller.bookings.getUserBookingsForLesson({ lessonId: lesson.id })
      
      // If user has 2+ bookings, redirect to manage page
      if (userBookings.length >= 2) {
        return `/bookings/${lesson.id}/manage`
      }
    } catch (error) {
      // If fetching bookings fails, continue to booking page (don't block)
      console.error('Error checking user bookings for redirect:', error)
    }
    
    return null
  },
}

export default async function BookingPage({ params }: BookingPageProps) {
  const { id } = await params
  return createBookingPage(id, bookingPageConfig)
}
