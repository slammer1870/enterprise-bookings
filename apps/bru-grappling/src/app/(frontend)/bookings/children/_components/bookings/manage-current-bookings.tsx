import { useSuspenseQuery } from '@tanstack/react-query'

import { useTRPC } from '@repo/trpc'

import { ChildBookingDetail } from '../child-booking-detail'

export const ManageCurrentBookings = ({ lessonId }: { lessonId: number }) => {
  const tprc = useTRPC()

  const { data: bookings } = useSuspenseQuery(
    tprc.bookings.getChildrensBookings.queryOptions({ id: lessonId }),
  )

  if (!bookings.length) return null

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-medium">Manage Current Bookings</h1>
      {bookings.map((booking) => (
        <ChildBookingDetail key={booking.id} booking={booking} />
      ))}
    </div>
  )
}
