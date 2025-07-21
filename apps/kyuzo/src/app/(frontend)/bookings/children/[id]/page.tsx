import { getMeUser } from '@repo/auth'

import { Lesson } from '@repo/shared-types'

import { redirect } from 'next/navigation'

import { getPayload } from 'payload'

import config from '@payload-config'

import { ChildrensBooking } from '@/components/children'

export default async function ChildrenBookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const payload = await getPayload({ config })

  // Auth check
  await getMeUser({
    nullUserRedirect: `/login?callbackUrl=/bookings/${id}`,
  })

  // Get lesson using payload client as this is in the lesson page
  const lesson = (await payload.findByID({
    collection: 'lessons',
    id: id,
    depth: 5,
  })) as Lesson

  if (!lesson) {
    redirect('/dashboard')
  }

  // Redirect if lesson is not a child lesson
  if (lesson.classOption.type != 'child') redirect('/dashboard')

  // Redirect if lesson is booked or closed
  if (['booked', 'closed'].includes(lesson.bookingStatus)) {
    redirect('/dashboard')
  }

  // Redirect if lesson is full
  if (lesson.remainingCapacity <= 0) {
    redirect('/dashboard')
  }

  return <ChildrensBooking lesson={lesson} />
}
