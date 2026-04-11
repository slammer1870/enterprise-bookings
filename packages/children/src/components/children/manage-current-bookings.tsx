'use client'

import { useSuspenseQuery } from '@tanstack/react-query'
import { useTRPC } from '@repo/trpc/client'
import { ChildBookingDetail } from './child-booking-detail'

export const ManageCurrentBookings = ({ timeslotId }: { timeslotId: number }) => {
  const trpc = useTRPC()

  const { data: bookings } = useSuspenseQuery(trpc.bookings.getChildrensBookings.queryOptions({ id: timeslotId }))

  if (!bookings || !Array.isArray(bookings) || !bookings.length) return null

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-medium">Manage Current Bookings</h1>
      {bookings.map((booking) => (
        <ChildBookingDetail key={booking.id} booking={booking as any} />
      ))}
    </div>
  )
}


