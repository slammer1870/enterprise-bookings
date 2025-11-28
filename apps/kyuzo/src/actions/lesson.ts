import { getLesson } from '@repo/bookings-plugin/src/utils/lesson'
import { Subscription } from '@repo/shared-types'

export const getLessonBookingLimit = async (
  lessonId: string,
  subscription: Subscription | null,
) => {
  const lesson = await getLesson(lessonId)

  console.log(lesson)

  if (subscription?.plan?.quantity) {
    if (lesson.remainingCapacity < subscription?.plan?.quantity) {
      console.log('Lesson remaining capacity is less than subscription quantity')

      console.log('Lesson remaining capacity', lesson.remainingCapacity)
      return lesson.remainingCapacity
    }

    console.log('Lesson remaining capacity is greater than subscription quantity')
    console.log('Subscription quantity', subscription?.plan?.quantity)
    return subscription?.plan?.quantity
  }

  console.log('No subscription quantity')
  return lesson.remainingCapacity
}
