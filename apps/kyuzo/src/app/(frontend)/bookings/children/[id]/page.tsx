import { getMeUser } from '@repo/auth/src/utils/get-me-user'

import { Lesson, Subscription } from '@repo/shared-types'

import { redirect } from 'next/navigation'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@repo/ui/components/ui/tabs'

import { getPayload } from 'payload'

import config from '@payload-config'

import { hasActiveSubscription, hasReachedSubscriptionLimit } from '@repo/shared-services'

import { PlanView } from '@repo/memberships/src/components/plans/plan-view'

import { BookingDetails } from '@repo/shared-types'

import { createCheckoutSession, createCustomerPortal } from '@repo/memberships/src/actions/plans'

import { getChildren } from '@/actions/children'

import { ChildrensBooking } from '@/components/childrens-booking'

export default async function ChildrenBookingPage({ params }: { params: Promise<{ id: string }> }) {
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

  if (lesson.classOption.type != 'child') redirect('/dashboard')

  if (['booked', 'closed'].includes(lesson.bookingStatus)) {
    redirect('/dashboard')
  }

  // Extract booking details
  const bookingDetails: BookingDetails = {
    date: new Date(lesson.date),
    startTime: lesson.startTime,
    endTime: lesson.endTime,
    bookingType: lesson.classOption.name,
    currency: 'EUR',
    maxCapacity: lesson.remainingCapacity,
    currentAttendees:
      lesson.bookings?.docs?.filter((booking) => booking.status === 'confirmed').length || 0,
    adjustableQuantity: lesson.classOption.paymentMethods?.allowedDropIn?.adjustable || false,
  }

  const hasAllowedPlans = lesson.classOption.paymentMethods?.allowedPlans

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

  const subscription = subscriptionQuery.docs[0] as unknown as Subscription

  const subscriptionLimitReached = subscription
    ? await hasReachedSubscriptionLimit(subscription, payload, new Date(lesson.startTime))
    : false

  const activeSubscription = await hasActiveSubscription(user.id, payload)

  const children = await getChildren(user.id)

  return (
    <div className="container mx-auto max-w-screen-sm flex flex-col gap-4 px-4 py-8 min-h-screen pt-24">
      {hasAllowedPlans && !activeSubscription ? (
        <>
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
                hasReachedSubscriptionLimit={subscriptionLimitReached}
                handlePlanPurchase={createCheckoutSession}
                handleSubscriptionManagement={createCustomerPortal}
                lessonDate={new Date(lesson.startTime)}
              />
            </TabsContent>
          </Tabs>
        </>
      ) : (
        <ChildrensBooking
          bookingDetails={bookingDetails}
          childrenData={children}
          hasAllowedPlans={!!hasAllowedPlans}
          activeSubscription={activeSubscription}
          allowedPlans={allowedPlans || []}
          subscription={subscription}
          subscriptionLimitReached={subscriptionLimitReached}
          lesson={lesson}
        />
      )}
    </div>
  )
}
