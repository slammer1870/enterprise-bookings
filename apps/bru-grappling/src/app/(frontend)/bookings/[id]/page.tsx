import { getSession } from '@/lib/auth/context/get-context-props'

import { Lesson } from '@repo/shared-types'

import { redirect } from 'next/navigation'

import { createCaller } from '@/trpc/server'

import { BookingSummary } from '@repo/bookings-next'

import { getPayload } from '@/lib/payload'


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
    redirect(`/complete-booking?mode=login&callbackUrl=/bookings/${id}`)
  }

  const payload = await getPayload()

  // This page is already gated by Better Auth above.
  // Use overrideAccess to ensure we always fetch the full lesson shape needed for payment UI
  // (classOption + paymentMethods), regardless of underlying collection access filters.
  const lesson = (await payload.findByID({
    collection: 'lessons',
    id,
    depth: 5,
    overrideAccess: true,
  })) as Lesson

  if (!lesson) {
    redirect('/dashboard')
  }

  // Debugging aid for E2E: verify the payment methods are actually present on the fetched lesson.
  // (Playwright looks for the "Drop-in" tab which depends on allowedDropIn being present.)
  try {
    const co: any = (lesson as any)?.classOption
    const pm: any = co && typeof co === 'object' ? co.paymentMethods : null
    // eslint-disable-next-line no-console
    console.log('[bru-grappling]/bookings/[id] lesson paymentMethods', {
      lessonId: (lesson as any)?.id,
      classOptionType: typeof co,
      hasAllowedDropIn: Boolean(pm?.allowedDropIn),
      hasAllowedPlans: Array.isArray(pm?.allowedPlans) && pm.allowedPlans.length > 0,
    })
  } catch {
    // ignore
  }

  if (['booked', 'closed'].includes(lesson.bookingStatus)) {
    redirect('/dashboard')
  }

  // Attempt check-in if the viewer already has entitlement (e.g. active subscription).
  // If the viewer does NOT have entitlement, this must *not* crash the page — we should fall
  // through and render the payment methods UI so they can complete checkout.
  try {
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
  } catch {
    // ignore and continue to payment UI
  }

  return (
    <div className="container mx-auto max-w-screen-sm flex flex-col gap-4 px-4 py-8 min-h-screen pt-24">
      <BookingSummary lesson={lesson} />
      <PaymentMethods lesson={lesson} />
    </div>
  )
}
