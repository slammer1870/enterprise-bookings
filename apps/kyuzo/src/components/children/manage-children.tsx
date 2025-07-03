import { getChildren } from '@/actions/children'

import { ChildrenBookingForm } from './children-form'
import { getActiveSubscription } from '@repo/memberships/src/utils/subscription'
import { getLessonBookingLimit } from '@/actions/lesson'

export const ManageChildren = async ({ lessonId }: { lessonId: string }) => {
  const children = await getChildren()

  const subscription = await getActiveSubscription()

  const lessonBookingLimit = await getLessonBookingLimit(lessonId, subscription)

  return (
    <ChildrenBookingForm
      children={children}
      lessonId={lessonId}
      lessonBookingLimit={lessonBookingLimit}
    />
  )
}
