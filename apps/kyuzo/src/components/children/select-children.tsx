import { Lesson, User } from '@repo/shared-types'

type SelectChildrenProps = {
  lesson: Lesson
  user: User
}

export const SelectChildren = () => {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-2xl font-bold">Select a child</h2>
      <div className="flex flex-col gap-4"></div>
    </div>
  )
}
