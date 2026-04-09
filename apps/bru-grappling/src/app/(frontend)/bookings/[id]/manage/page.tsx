import { redirect } from 'next/navigation'

import { getSession } from '@/lib/auth/context/get-context-props'
import { createCaller } from '@/trpc/server'

import { ManageBookingPageClient } from '@repo/bookings-next'
import { PaymentMethods } from '@repo/payments-next'

// Uses getSession()/headers() and createCaller(); must be dynamic in production.
export const dynamic = 'force-dynamic'

type ManageBookingPageProps = {
  params: Promise<{ id: string }>
}

export default async function ManageBookingPage({ params }: ManageBookingPageProps) {
  const { id: idParam } = await params

  const id = parseInt(idParam, 10)
  if (isNaN(id)) {
    redirect('/dashboard')
  }

  const session = await getSession()
  const user = session?.user
  if (!user) {
    redirect(`/complete-booking?mode=login&callbackUrl=/bookings/${id}/manage`)
  }

  const caller = await createCaller()

  // Fetch existing bookings. You must have at least one booking to manage.
  const userBookings = await caller.bookings.getUserBookingsForTimeslot({ timeslotId: id })
  const bookingCount = userBookings?.length ?? 0
  if (bookingCount === 0) {
    redirect(`/bookings/${id}`)
  }

  // getByIdForBooking rejects timeslots that are 'booked' or 'closed', but we need to allow
  // managing bookings even when capacity is full.
  const timeslot = await caller.timeslots.getById({ id })

  return (
    <div className="container mx-auto max-w-screen-sm flex flex-col gap-4 px-4 py-8 min-h-screen pt-24">
      <ManageBookingPageClient
        timeslot={timeslot}
        initialBookings={userBookings}
        PaymentMethodsComponent={PaymentMethods}
      />
    </div>
  )
}

