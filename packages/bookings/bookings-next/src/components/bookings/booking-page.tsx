import { redirect } from 'next/navigation'
import { Timeslot } from '@repo/shared-types'
import { BookingPageClient } from './booking-page-client'
import React from 'react'

export interface BookingPageConfig {
  /**
   * Function to get the current session/user
   * Should return null if user is not authenticated
   */
  getSession: () => Promise<{ user: any } | null>
  
  /**
   * Function to create tRPC caller.
   * May receive opts.host so tenant can be resolved from the same request that is rendering the page.
   */
  createCaller: (opts?: { host?: string }) => Promise<any>
  /**
   * Optional: get the request host (e.g. for tenant subdomain resolution).
   * When provided, createBookingPage will pass it to createCaller so getByIdForBooking sees the correct host.
   */
  getRequestHost?: () => Promise<string>
  
  /**
   * Redirect path when user is not authenticated
   * Can include {id} placeholder for the timeslot ID
   */
  authRedirectPath: string | ((id: number) => string)
  
  /**
   * Redirect path for errors (invalid ID, timeslot not found, etc.)
   */
  errorRedirectPath: string
  
  /**
   * Optional: Custom validation before fetching timeslot
   * Return a redirect path if validation fails, or null to continue
   */
  preValidation?: (id: number, user: any) => Promise<string | null>
  
  /**
   * Optional: Custom validation after fetching timeslot
   * Return a redirect path if validation fails, or null to continue
   * @param timeslot - The timeslot that was fetched
   * @param user - The authenticated user
   * @param caller - The tRPC caller (already created with proper context)
   */
  postValidation?: (timeslot: Timeslot, user: any, caller: any) => Promise<string | null>
  
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
   * BookingPageClient: ({ timeslot, onSuccessRedirect }) => (
   *   <CustomBookingPageWithPayments 
   *     timeslot={timeslot} 
   *     onSuccessRedirect={onSuccessRedirect}
   *   />
   * )
   * ```
   */
  BookingPageClient?: React.ComponentType<{
    timeslot: Timeslot
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

  try {
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

    // Fetch timeslot via tRPC (pass host when available so tenant resolution uses the same request's host)
    const host = config.getRequestHost ? await config.getRequestHost() : undefined
    const caller = await config.createCaller(host ? { host } : undefined)

    const timeslot = await caller.timeslots.getByIdForBooking({ id })

    // Post-validation (if provided)
    if (config.postValidation) {
      const postValidationRedirect = await config.postValidation(timeslot, user, caller)
      if (postValidationRedirect) {
        redirect(postValidationRedirect)
      }
    }

    // Attempt check-in if configured
    if (config.attemptCheckIn) {
      const checkInResult = await caller.bookings.validateAndAttemptCheckIn({
        timeslotId: id,
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
    // Ensure timeslot is plain-data so RSC serialization cannot throw (e.g. Dates, virtuals, or Payload internals)
    const serializableTimeslot = JSON.parse(JSON.stringify(timeslot)) as Timeslot

    const content = (
      <div className="container mx-auto max-w-screen-sm flex flex-col gap-4 px-4 py-8 min-h-screen pt-24">
        <ClientComponent timeslot={serializableTimeslot} onSuccessRedirect={config.onSuccessRedirect} />
      </div>
    )

    // Use custom wrapper if provided
    if (config.Wrapper) {
      return <config.Wrapper>{content}</config.Wrapper>
    }

    return content
  } catch (error: any) {
    // Preserve Next.js redirects (e.g. from postValidation -> /bookings/[id]/manage)
    const isNextRedirect =
      error?.digest?.startsWith?.('NEXT_REDIRECT') ||
      error?.message === 'NEXT_REDIRECT'
    if (isNextRedirect) {
      throw error
    }
    // Redirect on known client-facing errors
    const code = error?.data?.code
    const msg = typeof error?.message === 'string' ? error.message : ''
    const isNotFound =
      code === 'NOT_FOUND' || /not found/i.test(msg)
    const isBadRequest = code === 'BAD_REQUEST'
    if (isNotFound || isBadRequest) {
      redirect(config.errorRedirectPath)
    }
    // Log and redirect on any other error so we never show the global error boundary
    console.error('[createBookingPage] Error:', error?.message ?? error)
    if (error?.stack) console.error('[createBookingPage] Stack:', error.stack)
    redirect(config.errorRedirectPath)
  }
}
