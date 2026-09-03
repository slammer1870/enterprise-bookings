import { cache } from 'react'
import { cookies, headers } from 'next/headers'
import { getPayload } from '@/lib/payload'
import { getTenantContext } from '@/utilities/getTenantContext'
import { getCheckoutLegalForTenant } from '@/lib/checkout/getCheckoutLegalForTenant'
import type { CourseDetailDoc } from '@/components/courses/CourseDetailView'
import type { CheckoutLegalConfig } from '@repo/payments-next'

export type OpenCourseListItem = CourseDetailDoc & {
  activeEnrollmentCount: number
}

export const queryOpenCourses = cache(async (): Promise<OpenCourseListItem[]> => {
  const cookieStore = await cookies()
  const headersList = await headers()
  const payload = await getPayload()
  const tenant = await getTenantContext(payload, { cookies: cookieStore, headers: headersList })
  const tenantId = tenant?.id
  if (tenantId == null) return []
  const today = new Date().toISOString().slice(0, 10)

  const result = await payload.find({
    collection: 'courses' as import('payload').CollectionSlug,
    where: {
      and: [
        { tenant: { equals: tenantId } },
        { status: { equals: 'open' } },
        {
          or: [{ startDate: { exists: false } }, { startDate: { greater_than_equal: today } }],
        },
      ],
    },
    sort: 'title',
    limit: 50,
    depth: 1,
    overrideAccess: true,
  })

  const courses = result.docs as CourseDetailDoc[]
  const coursesWithCounts = await Promise.all(
    courses.map(async (course) => {
      const enrollments = await payload.find({
        collection: 'course-enrollments' as import('payload').CollectionSlug,
        where: {
          and: [
            { course: { equals: course.id } },
            { tenant: { equals: tenantId } },
            { status: { equals: 'active' } },
          ],
        },
        limit: 0,
        depth: 0,
        overrideAccess: true,
      })

      return {
        ...course,
        activeEnrollmentCount: enrollments.totalDocs ?? 0,
      }
    }),
  )

  return coursesWithCounts
})

export const queryCourseBySlug = cache(
  async (
    slug: string,
  ): Promise<{
    course: CourseDetailDoc
    activeEnrollmentCount: number
    checkoutLegal: CheckoutLegalConfig | null
  } | null> => {
    const cookieStore = await cookies()
    const headersList = await headers()
    const payload = await getPayload()
    const tenant = await getTenantContext(payload, { cookies: cookieStore, headers: headersList })
    const tenantId = tenant?.id
    if (tenantId == null) return null
    const today = new Date().toISOString().slice(0, 10)

    const result = await payload.find({
      collection: 'courses' as import('payload').CollectionSlug,
      where: {
        and: [
          { tenant: { equals: tenantId } },
          { slug: { equals: slug } },
          { status: { not_equals: 'archived' } },
          {
            or: [{ startDate: { exists: false } }, { startDate: { greater_than_equal: today } }],
          },
        ],
      },
      limit: 1,
      depth: 1,
      overrideAccess: true,
    })

    const course = result.docs[0] as CourseDetailDoc | undefined
    if (!course) return null

    const enrollments = await payload.find({
      collection: 'course-enrollments' as import('payload').CollectionSlug,
      where: {
        and: [
          { course: { equals: course.id } },
          { tenant: { equals: tenantId } },
          { status: { equals: 'active' } },
        ],
      },
      limit: 0,
      depth: 0,
      overrideAccess: true,
    })

    const checkoutLegal = await getCheckoutLegalForTenant(tenantId)

    return {
      course,
      activeEnrollmentCount: enrollments.totalDocs ?? 0,
      checkoutLegal,
    }
  },
)
