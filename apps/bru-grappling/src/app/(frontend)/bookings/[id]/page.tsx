import { getSession } from '@/lib/auth/context/get-context-props'

import { Lesson } from '@repo/shared-types'

import { redirect } from 'next/navigation'

import { createCaller } from '@/trpc/server'

import { BookingSummary } from '@repo/bookings-next'

import { getPayload } from 'payload'

import config from '@payload-config'

import { PaymentMethods } from '@repo/payments-next'

// Add these new types
type BookingPageProps = {
  params: Promise<{ id: number }>
}

export default async function BookingPage({ params }: BookingPageProps) {
  const { id } = await params

  // Auth check
  const session = await getSession()
  const user = session?.user

  if (!user) {
    redirect('/auth/sign-in?callbackUrl=/bookings/${id}')
  }

  const payload = await getPayload({ config })

  const lessonQuery = await payload.find({
    collection: 'lessons',
    where: {
      id: { equals: id },
    },
    depth: 5,
    overrideAccess: false,
    user: user,
  })

  const lesson = lessonQuery.docs[0] as Lesson

  if (!lesson) {
    redirect('/dashboard')
  }

  if (['booked', 'closed'].includes(lesson.bookingStatus)) {
    redirect('/dashboard')
  }

  // Attempt check-in if lesson status allows it (using tRPC procedure)
  const caller = await createCaller()
  const checkInResult = await caller.bookings.validateAndAttemptCheckIn({
    lessonId: id,
  })

  // Handle redirects based on check-in result
  if (checkInResult.shouldRedirect) {
    redirect('/dashboard')
  }

  // Handle special redirect cases
  if (checkInResult.error === 'REDIRECT_TO_CHILDREN_BOOKING' && checkInResult.redirectUrl) {
    redirect(checkInResult.redirectUrl)
  }

  return (
    <div className="container mx-auto max-w-screen-sm flex flex-col gap-4 px-4 py-8 min-h-screen pt-24">
      <BookingSummary lesson={lesson} />
      <PaymentMethods lesson={lesson} />
    </div>
  )
}
