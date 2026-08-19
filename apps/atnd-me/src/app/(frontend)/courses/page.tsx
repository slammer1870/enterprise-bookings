import Image from 'next/image'
import Link from 'next/link'
import { queryOpenCourses } from './queryCourses'
import { formatCourseAccessWindowCopy } from '@/lib/courses/format-course-access-window'
import { mediaUrl } from '@/components/events/eventPageTypes'
import { coursePlacesLabel } from '@/components/courses/coursePlacesLabel'
import type { Media } from '@/payload-types'

export const dynamic = 'force-dynamic'

export default async function CoursesPage() {
  const courses = await queryOpenCourses()

  return (
    <div className="container mx-auto pt-24 pb-12">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">Courses</h1>
      <p className="mt-2 text-muted-foreground">
        Enroll in a course to book allowed classes during your access window.
      </p>

      {courses.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">No courses are open right now.</p>
      ) : (
        <ul className="mt-8 max-w-xl space-y-4" data-testid="courses-list">
          {courses.map((course) => {
            const windowCopy = formatCourseAccessWindowCopy(course)
            const max =
              typeof course.maxEnrollments === 'number' && course.maxEnrollments >= 1
                ? course.maxEnrollments
                : null
            const remaining = max == null ? null : Math.max(0, max - course.activeEnrollmentCount)
            const places = coursePlacesLabel(remaining)
            const price =
              typeof course.priceInformation?.price === 'number'
                ? course.priceInformation.price
                : null
            const cover =
              course.coverImage && typeof course.coverImage === 'object'
                ? (course.coverImage as Media)
                : null
            const coverUrl = mediaUrl(cover)
            return (
              <li key={course.id}>
                <Link
                  href={`/courses/${course.slug}`}
                  className="flex gap-4 rounded-xl border border-border px-4 py-4 transition hover:bg-muted/40"
                  data-testid="course-list-item"
                >
                  {coverUrl ? (
                    <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg">
                      <Image
                        src={coverUrl}
                        alt={cover?.alt || course.title || 'Course'}
                        fill
                        sizes="112px"
                        className="object-cover"
                      />
                    </div>
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <h2 className="text-lg font-semibold text-foreground">{course.title}</h2>
                      {price != null ? (
                        <span className="text-base font-semibold tabular-nums">
                          €{price.toFixed(2)}
                        </span>
                      ) : null}
                    </div>
                    {windowCopy ? (
                      <p className="mt-1 text-sm text-muted-foreground">{windowCopy}</p>
                    ) : null}
                    {places ? (
                      <p
                        className={`mt-1 text-sm ${
                          remaining != null && remaining > 0 && remaining <= 6
                            ? 'font-medium text-amber-700 dark:text-amber-400'
                            : 'text-muted-foreground'
                        }`}
                        data-testid="course-list-places"
                      >
                        {places}
                      </p>
                    ) : null}
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
