import { getChildren } from '@/actions/children'

import { ChildrenBookingForm } from './children-form'
import { getActiveSubscription } from '@repo/memberships/src/utils/subscription'
import { getLessonBookingLimit } from '@/actions/lesson'

import { Booking } from '@repo/shared-types'

import { getMeUser } from '@repo/shared-services/src/user'

export const ManageChildren = async ({
  lessonId,
  bookings,
}: {
  lessonId: string
  bookings: Booking[]
}) => {
  const { user } = await getMeUser({ nullUserRedirect: '/login' })

  const children = await getChildren()

  const subscription = await getActiveSubscription()

  const lessonBookingLimit = await getLessonBookingLimit(lessonId, subscription)

  const childrenBookings = bookings.filter(
    (booking) => booking.user?.parent?.id === user?.id && booking.status === 'confirmed',
  )

  return (
    <ChildrenBookingForm
      children={children}
      lessonId={lessonId}
      lessonBookingLimit={lessonBookingLimit}
      childrenBookings={childrenBookings}
    />
  )
}
