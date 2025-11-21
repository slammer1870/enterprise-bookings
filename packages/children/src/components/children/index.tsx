import { Lesson } from '@repo/shared-types'

import { BookingSummary } from '@repo/bookings-plugin/src/components/ui/booking-summary'

import { ManagePayment } from '../manage-payment'
import { getMeUser } from '@repo/shared-services/src/user'

export const ChildrensBooking = async ({ lesson }: { lesson: Lesson }) => {
  const { user } = await getMeUser({ nullUserRedirect: '/login' })

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
        bookings={lesson.bookings.docs.filter(
          (booking) => booking.user?.parent?.id === user?.id && booking.status === 'confirmed',
        )}
      />
    </div>
  )
}
