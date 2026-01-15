import { Lesson } from '@repo/shared-types'

import { redirect } from 'next/navigation'

import { BookingSummary } from '@repo/bookings-next'

import { getPayload } from 'payload'

import config from '@payload-config'

import { getSession } from '@/lib/auth/context/get-context-props'
import { MembershipPaymentMethods } from '@repo/payments-next'
import { buildCompleteBookingUrl } from '@repo/shared-utils'
import { createCaller } from '@/trpc/server'

type BookingPageProps = {
  params: Promise<{ id: string }>
}

export default async function BookingPage({ params }: BookingPageProps) {
  const { id: idParam } = await params
  const id = parseInt(idParam, 10)
  if (Number.isNaN(id)) {
    redirect('/dashboard')
  }

  const session = await getSession()
  const user = session?.user
  if (!user) redirect(buildCompleteBookingUrl({ mode: 'login', callbackUrl: `/bookings/${id}` }))

  const payload = await getPayload({ config })

  const lessonQuery = await payload.find({
    collection: 'lessons',
    where: {
      id: { equals: id },
    },
    depth: 5,
    overrideAccess: false,
    user,
  })

  const lesson = lessonQuery.docs[0] as Lesson

  if (!lesson) {
    redirect('/dashboard')
  }

  if (lesson.classOption.type !== 'adult') redirect('/dashboard')

  if (['booked', 'closed'].includes(lesson.bookingStatus)) {
    redirect('/dashboard')
  }

  // Align with Bru methodology: attempt check-in if lesson status allows it.
  const caller = await createCaller()
  const checkInResult = await caller.bookings.validateAndAttemptCheckIn({ lessonId: id })

  if (checkInResult.shouldRedirect) {
    redirect('/dashboard')
  }

  if (checkInResult.error === 'REDIRECT_TO_CHILDREN_BOOKING' && checkInResult.redirectUrl) {
    redirect(checkInResult.redirectUrl)
  }

  if (lesson.remainingCapacity <= 0) {
    redirect('/dashboard')
  }

  return (
    <div className="container mx-auto max-w-screen-sm flex flex-col gap-4 px-4 py-8 min-h-screen pt-24">
      <BookingSummary lesson={lesson} />
      <MembershipPaymentMethods lesson={lesson} />
    </div>
  )
}
