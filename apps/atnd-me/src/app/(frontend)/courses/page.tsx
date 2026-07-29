import Link from 'next/link'
import { queryOpenCourses } from './queryCourses'
import { formatCourseAccessWindowCopy } from '@/lib/courses/format-course-access-window'

export const dynamic = 'force-dynamic'

export default async function CoursesPage() {
  const courses = await queryOpenCourses()

  return (
    <div className="container mx-auto max-w-3xl px-4 pt-24 pb-12">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">Courses</h1>
      <p className="mt-2 text-muted-foreground">
        Enroll in a course to book allowed classes during your access window.
      </p>

      {courses.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">No courses are open right now.</p>
      ) : (
        <ul className="mt-8 space-y-4" data-testid="courses-list">
          {courses.map((course) => {
            const windowCopy = formatCourseAccessWindowCopy(course)
            const price =
              typeof course.priceInformation?.price === 'number'
                ? course.priceInformation.price
                : null
            return (
              <li key={course.id}>
                <Link
                  href={`/courses/${course.slug}`}
                  className="block rounded-xl border border-border px-4 py-4 transition hover:bg-muted/40"
                  data-testid="course-list-item"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="text-lg font-semibold text-foreground">{course.title}</h2>
                    {price != null ? (
                      <span className="text-base font-semibold tabular-nums">€{price.toFixed(2)}</span>
                    ) : null}
                  </div>
                  {windowCopy ? (
                    <p className="mt-1 text-sm text-muted-foreground">{windowCopy}</p>
                  ) : null}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
