import { getMeUser } from '@repo/auth'

import { checkInAction } from '@repo/bookings/src/actions/bookings'

import { Lesson, Subscription, BookingDetails } from '@repo/shared-types'

import { redirect } from 'next/navigation'

import { BookingSummary } from '@repo/bookings/src/components/ui/booking-summary'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@repo/ui/components/ui/tabs'

import { getPayload } from 'payload'

import config from '@payload-config'

import { hasReachedSubscriptionLimit } from '@repo/shared-services'

import { PlanView } from '@repo/memberships/src/components/plans/plan-view'
import { DropInView } from '@repo/payments/src/components/drop-ins'

// Add these new types
type BookingPageProps = {
  params: Promise<{ id: number }>
}

export default async function BookingPage({ params }: BookingPageProps) {
  const { id } = await params

  // Auth check
  const { user } = await getMeUser({
    nullUserRedirect: `/login?callbackUrl=/bookings/${id}`,
  })

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

  if (lesson.classOption.type === 'child') {
    redirect(`/bookings/children/${id}`)
  }

  // Handle active/trialable status
  if (['active', 'trialable'].includes(lesson.bookingStatus)) {
    const checkIn = await checkInAction(lesson.id, user.id)
    if (checkIn.success) {
      redirect('/dashboard')
    }
  }

  // Note: bookingDetails was replaced with direct lesson usage in BookingSummary

  const allowedPlans = lesson.classOption.paymentMethods?.allowedPlans?.filter(
    (plan) => plan.status === 'active',
  )

  const subscriptionQuery = await payload.find({
    collection: 'subscriptions',
    where: {
      and: [
        {
          user: { equals: user.id },
          status: { not_in: ['canceled', 'unpaid', 'incomplete_expired', 'incomplete'] },
        },
      ],
    },
    depth: 3,
  })

  const subscription = subscriptionQuery.docs[0] as Subscription | null

  const subscriptionLimitReached = subscription
    ? await hasReachedSubscriptionLimit(subscription, payload, new Date(lesson.startTime))
    : false

  return (
    <div className="container mx-auto max-w-screen-sm flex flex-col gap-4 px-4 py-8 min-h-screen pt-24">
      <BookingSummary lesson={lesson} />
      <div className="">
        <h4 className="font-medium">Payment Methods</h4>
        <p className="font-light text-sm">Please select a payment method to continue:</p>
      </div>
      <Tabs defaultValue="membership">
        <TabsList className="flex w-full justify-around gap-4">
          {allowedPlans && allowedPlans.length > 0 && (
            <TabsTrigger value="membership" className="w-full">
              Membership
            </TabsTrigger>
          )}
          {lesson.classOption.paymentMethods?.allowedDropIn &&
            subscription?.status !== 'past_due' && (
              <TabsTrigger value="dropin" className="w-full">
                Drop-in
              </TabsTrigger>
            )}
        </TabsList>
        <TabsContent value="membership">
          <PlanView
            allowedPlans={allowedPlans}
            subscription={subscription}
            lessonDate={new Date(lesson.startTime)}
            subscriptionLimitReached={subscriptionLimitReached}
          />
        </TabsContent>
        <TabsContent value="dropin">
          {lesson.classOption.paymentMethods?.allowedDropIn ? (
            <DropInView
              bookingStatus={lesson.bookingStatus}
              dropIn={lesson.classOption.paymentMethods.allowedDropIn}
              quantity={1}
              metadata={{
                lessonId: lesson.id.toString(),
              }}
            />
          ) : (
            <div>Drop-in payment option is not available</div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
