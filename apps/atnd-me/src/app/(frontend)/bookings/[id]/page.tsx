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
    
    try {
      const userBookings = await caller.bookings.getUserBookingsForLesson({ lessonId: lesson.id })
      
      // If user has 2+ bookings, redirect to manage page
      if (userBookings.length >= 2) {
        return `/bookings/${lesson.id}/manage`
      }
    } catch (error) {
      // If fetching bookings fails, log the error but continue to booking page (don't block)
      // This could happen if tenant context is missing or there's a database issue
      console.error('Error checking user bookings for redirect:', error)
      // Re-throw in development to help debug
      if (process.env.NODE_ENV === 'development') {
        console.error('postValidation error details:', {
          lessonId: lesson.id,
          userId: user.id,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
    
    return null
  },
}

export default async function BookingPage({ params }: BookingPageProps) {
  const { id } = await params
  return createBookingPage(id, bookingPageConfig)
}
