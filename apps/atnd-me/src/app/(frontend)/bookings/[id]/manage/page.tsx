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
  const userBookings = await caller.bookings.getUserBookingsForTimeslot({ timeslotId: id })

  if ((userBookings?.length ?? 0) === 0) {
    redirect(`/bookings/${id}`)
  }

  try {
    const timeslot = await caller.timeslots.getById({ id })

    return (
      <div className="container mx-auto max-w-screen-sm flex flex-col gap-4 px-4 py-8 min-h-screen pt-24">
        <ManageBookingPageClient
          timeslot={timeslot}
          initialBookings={userBookings}
          PaymentMethodsComponent={PaymentMethodsConnect}
          cancelPendingApiUrl="/api/bookings/cancel-pending"
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
