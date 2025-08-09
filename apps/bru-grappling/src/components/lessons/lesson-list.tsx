import { Lesson } from '@repo/shared-types'
import { LessonDetail } from './lesson-detail'

export function LessonList({ lessons }: { lessons: Lesson[] }) {
  return (
    <div className="flex flex-col gap-4 md:gap-8 w-full">
      {lessons && lessons?.length > 0 ? (
        lessons?.map((lesson) => <LessonDetail key={lesson.id} lesson={lesson} />)
      ) : (
        <p>No lessons scheduled for today</p>
      )}
    </div>
  )
}
