import { Lesson } from '@repo/shared-types'
import { LessonDetail } from './lesson-detail'

export function LessonList({ 
  lessons,
  manageHref,
}: { 
  lessons: Lesson[];
  /**
   * Optional function or string to generate the manage booking URL.
   * Passed through to LessonDetail components.
   */
  manageHref?: string | ((lessonId: number) => string);
}) {
  return (
    <div className="flex flex-col gap-4 md:gap-8 w-full">
      {lessons && lessons?.length > 0 ? (
        lessons?.map((lesson) => (
          <LessonDetail key={lesson.id} lesson={lesson} manageHref={manageHref} />
        ))
      ) : (
        <p>No lessons scheduled for today</p>
      )}
    </div>
  )
}

