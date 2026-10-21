import { createBookingPage, BookingPageClientSmart, type BookingPageConfig } from '@repo/bookings-next'
import { PaymentMethodsConnect } from '@/components/payments/PaymentMethodsConnect.client'
import { currentUser, getSession } from '@/lib/auth/context/get-context-props'
import { createCaller } from '@/trpc/server'
import { cookies } from 'next/headers'
import { getRequestHost, redirectToManageIfMultipleBookings } from './utils'
import { pauseBeforeViewerHoldLookup } from './e2e-hold-read-split'
import { readLiveRemainingCapacity } from './live-remaining-capacity'
import { getCheckoutLegalForTenant } from '@/lib/checkout/getCheckoutLegalForTenant'
import type { CheckoutLegalConfig } from '@repo/payments-next'
import type { Timeslot } from '@repo/shared-types'
import type { ViewerCheckoutHold } from '@repo/shared-utils/booking-capacity'

async function getCheckoutLegal(timeslot: Timeslot): Promise<CheckoutLegalConfig | null> {
  const tenantId =
    timeslot.tenant != null && typeof timeslot.tenant === 'object'
      ? (timeslot.tenant as { id: number }).id
      : typeof timeslot.tenant === 'number'
        ? timeslot.tenant
        : null

  return getCheckoutLegalForTenant(tenantId)
}

function classPlaces(timeslot: Timeslot): number | null {
  const eventType = timeslot.eventType
  if (!eventType || typeof eventType !== 'object') return null
  const places = Number(eventType.places)
  return Number.isFinite(places) ? places : null
}

async function BookingPageWithLegal({
  timeslot,
  onSuccessRedirect,
}: {
  timeslot: Timeslot
  onSuccessRedirect?: string
}) {
  const checkoutLegal = await getCheckoutLegal(timeslot)
  // timeslot.remainingCapacity was already snapshotted, and it subtracts every
  // active hold. Production reload can drop this viewer's hold before the
  // lookup below. Keep that snapshot only when the hold is still theirs.
  const splitHoldRead = (await cookies()).get('e2e-split-hold-read')?.value === '1'
  await pauseBeforeViewerHoldLookup(timeslot.id, splitHoldRead)
  let initialCheckoutHold: ViewerCheckoutHold | null = null
  let holdLookupFailed = false
  try {
    const caller = await createCaller()
    const hold = await caller.bookings.getActiveCheckoutHold({ timeslotId: timeslot.id })
    if (hold && hold.quantity > 0) {
      initialCheckoutHold = {
        id: hold.id,
        quantity: hold.quantity,
        expiresAt: hold.expiresAt,
      }
    }
  } catch {
    holdLookupFailed = true
    initialCheckoutHold = null
  }

  let viewerTimeslot = timeslot
  const snapshotted = Math.max(0, Number(timeslot.remainingCapacity) || 0)
  const places = classPlaces(timeslot)
  const snapshotSubtractedCapacity = places == null || snapshotted < places
  if (initialCheckoutHold == null && !holdLookupFailed && snapshotSubtractedCapacity) {
    const live = await readLiveRemainingCapacity(timeslot.id)
    if (live != null) {
      viewerTimeslot = { ...timeslot, remainingCapacity: live }
    }
  }

  return (
    <BookingPageClientSmart
      timeslot={viewerTimeslot}
      onSuccessRedirect={onSuccessRedirect}
      PaymentMethodsComponent={PaymentMethodsConnect}
      useCheckoutHolds={true}
      initialCheckoutHold={initialCheckoutHold}
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
