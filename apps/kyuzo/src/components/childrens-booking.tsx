import { BookingDetails } from '@repo/shared-types'

import { BookingSummary } from '@repo/bookings/src/components/ui/booking-summary'

export const ChildrensBooking = ({ bookingDetails }: { bookingDetails: BookingDetails }) => {
  return (
    <div className="container mx-auto max-w-screen-sm flex flex-col gap-4 px-4 py-8 min-h-screen pt-24">
      <BookingSummary bookingDetails={bookingDetails} attendeesCount={1} />
    </div>
  )
}
