import { Lesson } from '@repo/shared-types'

import { BookingSummary } from '@repo/bookings/src/components/ui/booking-summary'

import { ManagePayment } from './manage-payment'

export const ChildrensBooking = ({ lesson }: { lesson: Lesson }) => {
  return (
    <div className="container mx-auto max-w-screen-sm flex flex-col gap-4 px-4 py-8 min-h-screen pt-24">
      <BookingSummary
        bookingDetails={{
          date: lesson.date,
          startTime: lesson.startTime,
          endTime: lesson.endTime,
          bookingType: lesson.classOption.name,
        }}
      />
      <ManagePayment
        plans={lesson.classOption.paymentMethods?.allowedPlans}
        lessonId={lesson.id.toString()}
      />
    </div>
  )
}
