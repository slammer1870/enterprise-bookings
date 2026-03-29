import { ScheduleLesson } from '@repo/shared-types'
import { LessonDetail } from './lesson-detail'

export function LessonList({ 
  lessons,
  manageHref,
}: { 
  lessons: ScheduleLesson[];
  /**
   * Optional function or string to generate the manage booking URL.
   * Defaults to `/bookings/[id]/manage` if not provided.
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
        <p className="text-muted-foreground">No lessons scheduled for today</p>
      )}
    </div>
  )
}

