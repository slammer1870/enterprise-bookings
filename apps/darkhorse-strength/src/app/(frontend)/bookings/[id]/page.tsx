import { redirect } from 'next/navigation'

import { Timeslot } from '@repo/shared-types'

import { getPayload } from 'payload'

import config from '@payload-config'

import { getSession } from '@/lib/auth/context/get-context-props'
import { createCaller } from '@/trpc/server'

import { BookingSummary } from '@repo/bookings-next'
import { PaymentMethods } from '@repo/payments-next'

// Route params are always strings in Next.js App Router
type BookingPageProps = {
  params: Promise<{ id: string }>
}

export default async function BookingPage({ params }: BookingPageProps) {
  const { id: idParam } = await params

  // Convert string ID to number and validate
  const id = parseInt(idParam, 10)
  if (isNaN(id)) {
    redirect('/dashboard')
  }

  // Auth check
  const session = await getSession()
  const user = session?.user

  if (!user) {
    redirect(`/auth/sign-in?callbackUrl=/bookings/${id}`)
  }

  const payload = await getPayload({ config })

  const timeslotQuery = await payload.find({
    collection: 'timeslots',
    where: {
      id: { equals: id },
    },
    depth: 5,
    overrideAccess: false,
    user: user as any,
  })

  const timeslot = timeslotQuery.docs[0] as unknown as Timeslot | undefined

  if (!timeslot) {
    redirect('/dashboard')
  }

  if (['booked', 'closed'].includes(timeslot.bookingStatus)) {
    redirect('/dashboard')
  }

  // Attempt check-in if timeslot status allows it (using tRPC procedure)
  const caller = await createCaller()
  const checkInResult = await caller.bookings.validateAndAttemptCheckIn({
    timeslotId: id,
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
      <BookingSummary timeslot={timeslot} />
      <PaymentMethods timeslot={timeslot} />
    </div>
  )
}
