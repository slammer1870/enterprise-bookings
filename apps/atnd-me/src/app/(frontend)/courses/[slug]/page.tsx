import { notFound } from 'next/navigation'
import { CourseDetailView } from '@/components/courses/CourseDetailView'
import { queryCourseBySlug } from '../queryCourses'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ slug: string }>
}

export default async function CourseDetailPage({ params }: PageProps) {
  const { slug } = await params
  const result = await queryCourseBySlug(slug)
  if (!result) notFound()

  return (
    <div className="container mx-auto">
      <CourseDetailView
        course={result.course}
        activeEnrollmentCount={result.activeEnrollmentCount}
        checkoutLegal={result.checkoutLegal}
      />
    </div>
  )
}
