import { redirect } from 'next/navigation'
import { ManageBookingPageClient } from '@repo/bookings-next'
import { PaymentMethodsConnect } from '@/components/payments/PaymentMethodsConnect.client'
import {
  parseTimeslotId,
  createCallerForBooking,
  requireAuthForBooking,
} from '@/lib/booking'

export const dynamic = 'force-dynamic'

type ManageBookingPageProps = {
  params: Promise<{ id: string }>
}

export default async function ManageBookingPage({ params }: ManageBookingPageProps) {
  const { id: idParam } = await params
  const id = parseTimeslotId(idParam)

  await requireAuthForBooking(id, `/bookings/${id}/manage`)

  const caller = await createCallerForBooking()
  let userBookings = await caller.bookings.getUserBookingsForTimeslot({ timeslotId: id })

  if ((userBookings?.length ?? 0) === 0) {
    redirect(`/bookings/${id}`)
  }

  try {
    const timeslot = await caller.timeslots.getById({ id })

    let initialCheckoutHold: { id: number; quantity: number; expiresAt: string } | null = null
    try {
      initialCheckoutHold = await caller.bookings.getActiveCheckoutHold({ timeslotId: id })
    } catch {
      initialCheckoutHold = null
    }

    // If the user has pending bookings but no active hold (e.g. admin created them via the
    // dashboard), cancel the pending rows and create a hold so the manage page opens directly
    // in checkout mode.  Without this, `isInCheckout` stays false and the quantity selector
    // shows with the Update Bookings button permanently disabled (desired === active count),
    // leaving the user unable to pay.
    //
    // Cancelling before creating the hold ensures fulfillCheckoutHold (called on payment
    // success) creates fresh confirmed bookings without leaving behind dangling pending rows.
    if (initialCheckoutHold === null) {
      const pendingOnly = (userBookings ?? []).filter(
        (b) => String((b as { status?: string }).status).toLowerCase() === 'pending',
      )
      if (pendingOnly.length > 0) {
        try {
          await caller.bookings.cancelPendingBookingsForTimeslot({ timeslotId: id })
          const holdResult = await caller.bookings.upsertCheckoutHold({
            timeslotId: id,
            quantity: pendingOnly.length,
          })
          initialCheckoutHold = {
            id: holdResult.holdId,
            quantity: holdResult.quantity,
            expiresAt: holdResult.expiresAt,
          }
          // Re-fetch so initialBookings reflects the cancelled-pending state.
          userBookings = await caller.bookings.getUserBookingsForTimeslot({ timeslotId: id })
        } catch {
          // Fall through — user sees the normal manage page without the payment prompt.
          initialCheckoutHold = null
        }
      }
    }

    return (
      <div className="container mx-auto max-w-screen-sm flex flex-col gap-4 px-4 py-8 min-h-screen pt-24">
        <ManageBookingPageClient
          timeslot={timeslot}
          initialBookings={userBookings}
          PaymentMethodsComponent={PaymentMethodsConnect}
          cancelPendingApiUrl="/api/bookings/cancel-pending"
          releaseHoldApiUrl="/api/bookings/release-hold"
          useCheckoutHolds={true}
          initialCheckoutHold={initialCheckoutHold}
          successUrl="/success"
        />
      </div>
    )
  } catch (error: unknown) {
    const err = error as { data?: { code?: string } }
    if (err?.data?.code === 'NOT_FOUND' || err?.data?.code === 'BAD_REQUEST') {
      redirect('/')
    }
    throw error
  }
}
