import { getMeUser } from '@repo/auth-next'

import { checkInAction } from '@repo/bookings-plugin/src/actions/bookings'

import { Lesson, Subscription } from '@repo/shared-types'

import { redirect } from 'next/navigation'

import { BookingSummary } from '@repo/bookings-plugin/src/components/ui/booking-summary'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@repo/ui/components/ui/tabs'

import { getPayload } from 'payload'

import config from '@payload-config'

import { hasReachedSubscriptionLimit } from '@repo/shared-services'

import { PlanView } from '@repo/memberships/src/components/plans/plan-view'

import { BookingDetails } from '@repo/shared-types'

// Add these new types
type BookingPageProps = {
  params: Promise<{ id: number }>
}

export default async function BookingPage({ params }: BookingPageProps) {
  const { id } = await params

  const payload = await getPayload({ config })

  // Auth check
  const { user } = await getMeUser({
    nullUserRedirect: `/login?callbackUrl=/bookings/${id}`,
  })

  const lessonQuery = await payload.find({
    collection: 'lessons',
    where: {
      id: { equals: id },
    },
    depth: 5,
  })

  const lesson = lessonQuery.docs[0] as Lesson

  if (!lesson) {
    redirect('/dashboard')
  }

  if (lesson.classOption.type != 'adult') redirect('/dashboard')

  if (['booked', 'closed'].includes(lesson.bookingStatus)) {
    redirect('/dashboard')
  }

  // Handle active/trialable status
  if (['active', 'trialable'].includes(lesson.bookingStatus)) {
    const checkIn = await checkInAction(lesson.id, user.id)
    if (checkIn.success) {
      redirect('/dashboard')
    }
  }

  if (lesson.remainingCapacity <= 0) {
    redirect('/dashboard')
  }

  // Extract booking details
  const bookingDetails: BookingDetails = {
    date: lesson.date,
    startTime: lesson.startTime,
    endTime: lesson.endTime,
    bookingType: lesson.classOption.name,
  }

  const allowedPlans = lesson.classOption.paymentMethods?.allowedPlans?.filter(
    (plan) => plan.status === 'active',
  )

  const subscriptionQuery = await payload.find({
    collection: 'subscriptions',
    where: {
      and: [
        {
          user: { equals: user.id },
          status: { not_equals: 'canceled' },
        },
      ],
    },
    depth: 3,
  })

  const subscription = subscriptionQuery.docs[0] as unknown as Subscription | null

  const subscriptionLimitReached = subscription
    ? await hasReachedSubscriptionLimit(subscription, payload, new Date(lesson.date))
    : false

  return (
    <div className="container mx-auto max-w-screen-sm flex flex-col gap-4 px-4 py-8 min-h-screen pt-24">
      <BookingSummary bookingDetails={bookingDetails} />
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
        </TabsList>
        <TabsContent value="membership">
          <PlanView
            allowedPlans={allowedPlans}
            subscription={subscription}
            lessonDate={new Date(lesson.date)}
            subscriptionLimitReached={subscriptionLimitReached}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
