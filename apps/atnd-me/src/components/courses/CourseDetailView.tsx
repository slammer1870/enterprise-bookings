import { currentUser } from '@/lib/auth/context/get-context-props'
import { CourseEnrollPanel } from '@/components/courses/CourseEnrollPanel'
import { formatCourseAccessWindowCopy } from '@/lib/courses/format-course-access-window'

export type CourseDetailDoc = {
  id: number
  title?: string | null
  slug?: string | null
  about?: string | null
  status?: string | null
  startDate?: string | null
  endDate?: string | null
  durationLength?: number | null
  durationUnit?: 'days' | 'weeks' | null
  maxEnrollments?: number | null
  priceInformation?: { price?: number | null } | null
}

type CourseDetailViewProps = {
  course: CourseDetailDoc
  activeEnrollmentCount?: number
}

export async function CourseDetailView({
  course,
  activeEnrollmentCount = 0,
}: CourseDetailViewProps) {
  const user = await currentUser()
  const isAuthenticated = Boolean(user?.id)
  const title = course.title?.trim() || 'Course'
  const price =
    typeof course.priceInformation?.price === 'number' ? course.priceInformation.price : 0
  const accessWindowLabel = formatCourseAccessWindowCopy(course)
  const max =
    typeof course.maxEnrollments === 'number' && course.maxEnrollments >= 1
      ? course.maxEnrollments
      : null
  const remaining = max == null ? null : Math.max(0, max - activeEnrollmentCount)
  const isOpen = course.status === 'open'

  return (
    <div className="pt-24 pb-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-x-8 lg:gap-y-6 lg:items-start">
        <header className="order-2 space-y-1.5 lg:col-start-1 lg:order-1">
          {accessWindowLabel ? (
            <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              {accessWindowLabel}
            </p>
          ) : null}
          <h1 className="max-w-3xl text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            {title}
          </h1>
          {remaining != null ? (
            <p
              className={`pt-1 text-sm lg:hidden ${
                remaining > 0 && remaining <= 6
                  ? 'font-medium text-amber-700 dark:text-amber-400'
                  : 'text-muted-foreground'
              }`}
              data-testid="course-meta-places"
            >
              {remaining <= 0
                ? 'Sold out'
                : remaining === 1
                  ? '1 place left'
                  : `${remaining} places left`}
            </p>
          ) : null}
        </header>

        <div className="order-1 lg:order-2 lg:col-start-2 lg:row-span-2 lg:self-start lg:sticky lg:top-24">
          <CourseEnrollPanel
            courseId={course.id}
            price={price}
            remainingEnrollments={remaining}
            isAuthenticated={isAuthenticated}
            isOpen={isOpen}
            accessWindowLabel={accessWindowLabel}
            successUrl="/success"
          />
        </div>

        {course.about?.trim() ? (
          <section className="order-3 lg:col-start-1">
            <p className="whitespace-pre-wrap text-muted-foreground">{course.about}</p>
          </section>
        ) : null}
      </div>
    </div>
  )
}
