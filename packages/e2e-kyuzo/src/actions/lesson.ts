import { getLesson } from '@repo/bookings-plugin/src/utils/lesson'
import { Subscription } from '@repo/shared-types'

export const getLessonBookingLimit = async (
  lessonId: string,
  subscription: Subscription | null,
) => {
  const lesson = await getLesson(lessonId)

  if (subscription?.plan?.quantity) {
    if (lesson.remainingCapacity < subscription?.plan?.quantity) {
      return lesson.remainingCapacity
    }

    return subscription?.plan?.quantity
  }

  return lesson.remainingCapacity
}
