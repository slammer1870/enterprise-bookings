import { redirect } from 'next/navigation'
import { Lesson } from '@repo/shared-types'
import { BookingPageClient } from './booking-page-client'
import React from 'react'

export interface BookingPageConfig {
  /**
   * Function to get the current session/user
   * Should return null if user is not authenticated
   */
  getSession: () => Promise<{ user: any } | null>
  
  /**
   * Function to create tRPC caller
   */
  createCaller: () => Promise<any>
  
  /**
   * Redirect path when user is not authenticated
   * Can include {id} placeholder for the lesson ID
   */
  authRedirectPath: string | ((id: number) => string)
  
  /**
   * Redirect path for errors (invalid ID, lesson not found, etc.)
   */
  errorRedirectPath: string
  
  /**
   * Optional: Custom validation before fetching lesson
   * Return a redirect path if validation fails, or null to continue
   */
  preValidation?: (id: number, user: any) => Promise<string | null>
  
  /**
   * Optional: Custom validation after fetching lesson
   * Return a redirect path if validation fails, or null to continue
   * @param lesson - The lesson that was fetched
   * @param user - The authenticated user
   * @param caller - The tRPC caller (already created with proper context)
   */
  postValidation?: (lesson: Lesson, user: any, caller: any) => Promise<string | null>
  
  /**
   * Optional: Whether to attempt check-in before showing booking page
   * If true, will call validateAndAttemptCheckIn and handle redirects
   */
  attemptCheckIn?: boolean
  
  /**
   * Optional: Custom redirect path after successful booking
   */
  onSuccessRedirect?: string
  
  /**
   * Optional: Custom wrapper component or layout
   */
  Wrapper?: React.ComponentType<{ children: React.ReactNode }>
  
  /**
   * Optional: Custom booking page client component
   * Allows apps to customize the booking page UI, especially for payment method integration.
   * If not provided, uses the default BookingPageClient (MVP - no payment methods).
   * 
   * @example
   * ```tsx
   * BookingPageClient: ({ lesson, onSuccessRedirect }) => (
   *   <CustomBookingPageWithPayments 
   *     lesson={lesson} 
   *     onSuccessRedirect={onSuccessRedirect}
   *   />
   * )
   * ```
   */
  BookingPageClient?: React.ComponentType<{
    lesson: Lesson
    onSuccessRedirect?: string
  }>
}

/**
 * Shared booking page logic that can be used across all apps.
 * Apps should call this from their route files and pass app-specific configuration.
 * 
 * @example
 * ```tsx
 * // In apps/my-app/src/app/(frontend)/bookings/[id]/page.tsx
 * import { createBookingPage } from '@repo/bookings-next'
 * 
 * export default createBookingPage({
 *   getSession: async () => {
 *     const session = await getSession()
 *     return session ? { user: session.user } : null
 *   },
 *   createCaller,
 *   authRedirectPath: (id) => `/login?callback=/bookings/${id}`,
 *   errorRedirectPath: '/dashboard',
 * })
 * ```
 */
export async function createBookingPage(
  idParam: string,
  config: BookingPageConfig
): Promise<React.ReactElement> {
  // Convert string ID to number and validate
  const id = parseInt(idParam, 10)
  if (isNaN(id)) {
    redirect(config.errorRedirectPath)
  }

  // Auth check
  const session = await config.getSession()
  const user = session?.user

  if (!user) {
    const redirectPath = typeof config.authRedirectPath === 'function'
      ? config.authRedirectPath(id)
      : config.authRedirectPath.replace('{id}', id.toString())
    redirect(redirectPath)
  }

  // Pre-validation (if provided)
  if (config.preValidation) {
    const preValidationRedirect = await config.preValidation(id, user)
    if (preValidationRedirect) {
      redirect(preValidationRedirect)
    }
  }

  // Fetch lesson via tRPC
  const caller = await config.createCaller()

  try {
    const lesson = await caller.lessons.getByIdForBooking({ id })

    // Post-validation (if provided)
    if (config.postValidation) {
      const postValidationRedirect = await config.postValidation(lesson, user, caller)
      if (postValidationRedirect) {
        redirect(postValidationRedirect)
      }
    }

    // Attempt check-in if configured
    if (config.attemptCheckIn) {
      const checkInResult = await caller.bookings.validateAndAttemptCheckIn({
        lessonId: id,
      })

      // Handle redirects based on check-in result
      if (checkInResult.shouldRedirect) {
        redirect(config.errorRedirectPath)
      }

      // Handle special redirect cases
      if (checkInResult.error === 'REDIRECT_TO_CHILDREN_BOOKING' && checkInResult.redirectUrl) {
        redirect(checkInResult.redirectUrl)
      }
    }

    // Use custom BookingPageClient if provided, otherwise use default
    const ClientComponent = config.BookingPageClient || BookingPageClient
    
    const content = (
      <div className="container mx-auto max-w-screen-sm flex flex-col gap-4 px-4 py-8 min-h-screen pt-24">
        <ClientComponent lesson={lesson} onSuccessRedirect={config.onSuccessRedirect} />
      </div>
    )

    // Use custom wrapper if provided
    if (config.Wrapper) {
      return <config.Wrapper>{content}</config.Wrapper>
    }

    return content
  } catch (error: any) {
    // Handle tRPC errors - redirect on validation errors
    if (error?.data?.code === 'NOT_FOUND' || error?.data?.code === 'BAD_REQUEST') {
      redirect(config.errorRedirectPath)
    }
    // Re-throw other errors
    throw error
  }
}
