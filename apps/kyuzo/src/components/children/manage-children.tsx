import { getChildren } from '@/actions/children'

import { ChildrenBookingForm } from './children-form'

export const ManageChildren = async ({ lessonId }: { lessonId: string }) => {
  const children = await getChildren()
  return <ChildrenBookingForm children={children} lessonId={lessonId} />
}
