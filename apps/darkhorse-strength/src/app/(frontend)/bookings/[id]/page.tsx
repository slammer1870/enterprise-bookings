import { getMeUser } from '@repo/auth'

import { checkInAction } from '@repo/bookings/src/actions/bookings'

import { Lesson, Subscription } from '@repo/shared-types'

import { redirect } from 'next/navigation'

import { BookingSummary } from '@repo/bookings/src/components/ui/booking-summary'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@repo/ui/components/ui/tabs'

import { getPayload } from 'payload'

import config from '@payload-config'

import { PlanList } from '@repo/memberships/src/components/plans/plan-list'
import { hasReachedSubscriptionLimit } from '@repo/shared-services'
import { PlanDetail } from '@repo/memberships/src/components/plans/plan-detail'
import { BookingDetails } from '@repo/shared-types'

// Add these new types
type BookingPageProps = {
  params: Promise<{ id: number }>
}

// Utility function to get lesson data
async function getLessonData(id: number, token?: string): Promise<Lesson> {
  const response = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/lessons/${id}?depth=5`, {
    headers: { Authorization: `JWT ${token}` },
  })

  if (!response.ok) {
    throw new Error('Failed to fetch lesson data')
  }

  return response.json()
}

// Utility function to get subscription data
async function getSubscriptionData(payload: any, userId: number) {
  return payload.find({
    collection: 'subscriptions',
    where: {
      and: [
        {
          user: { equals: userId },
          status: { not_equals: 'canceled' },
        },
      ],
    },
    depth: 3,
  })
}

export default async function BookingPage({ params }: BookingPageProps) {
  const { id } = await params

  // Auth check
  const { token, user } = await getMeUser({
    nullUserRedirect: `/login?callbackUrl=/bookings/${id}`,
  })

  const payload = await getPayload({ config })

  const lesson = await getLessonData(id, token)

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

  const subscriptionQuery = await getSubscriptionData(payload, user.id)
  const subscription = subscriptionQuery.docs[0] as Subscription

  const handlePlanPurchase = async (
    planId?: string,
    metadata?: { [key: string]: string | undefined },
  ) => {
    'use server'
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SERVER_URL}/api/stripe/create-checkout-session`,
      {
        method: 'POST',
        body: JSON.stringify({ price: planId, quantity: 1, metadata }),
        headers: { Authorization: `JWT ${token}` },
      },
    )

    const data = await response.json()

    if (data.url) {
      redirect(data.url)
    } else {
    }
  }

  const handleSubscriptionManagement = async () => {
    'use server'
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SERVER_URL}/api/stripe/create-customer-portal`,
      {
        method: 'POST',
        headers: { Authorization: `JWT ${token}` },
      },
    )
    const data = await response.json()

    if (data.url) {
      redirect(data.url)
    } else {
    }
  }

  return (
    <div className="container mx-auto max-w-screen-sm flex flex-col gap-4 px-4 py-8 min-h-screen pt-24">
      <BookingSummary lesson={lesson} />
      <div className="">
        <h4 className="font-medium">Payment Methods</h4>
        <p className="font-light text-sm">Please select a payment method to continue</p>
      </div>
      <Tabs defaultValue="membership">
        <TabsList className="flex w-full justify-around gap-4">
          <TabsTrigger value="membership" className="w-full">
            Membership
          </TabsTrigger>
        </TabsList>
        <TabsContent value="membership">
          {!allowedPlans ? (
            <p className="text-sm text-muted-foreground">No plans are available for this lesson</p>
          ) : (
            <div>
              {!subscription ? (
                <PlanList
                  plans={allowedPlans}
                  actionLabel="Subscribe"
                  onAction={handlePlanPurchase}
                />
              ) : (
                <div>
                  {!allowedPlans.some((plan) => plan.id === subscription.plan.id) ? (
                    <>
                      <p className="text-sm mb-2 text-red-500 ">
                        You do not have a plan that allows you to book into this lesson, please
                        upgrade your plan to continue
                      </p>
                      <PlanList
                        plans={allowedPlans.filter((plan) => plan.id !== subscription.plan.id)}
                        actionLabel="Upgrade"
                        onAction={handlePlanPurchase}
                      />
                    </>
                  ) : (
                    <>
                      {(await hasReachedSubscriptionLimit(
                        subscription,
                        payload,
                        new Date(lesson.date),
                      )) && (
                        <p className="text-sm text-red-500 mb-2">
                          You have reached the limit of your subscription
                        </p>
                      )}
                      {subscription.status === 'unpaid' ||
                        (subscription.status === 'past_due' && (
                          <p className="text-sm text-red-500 mb-2">
                            Your Subscription is past due. Please pay your subscription to continue.
                          </p>
                        ))}
                      {subscription.cancelAt &&
                        new Date(subscription.cancelAt) < new Date(lesson.date) && (
                          <p className="text-sm text-red-500 mb-2">
                            {`Your subscription currently ends on ${new Date(subscription.cancelAt).toLocaleDateString()} please upgrade your plan.`}
                          </p>
                        )}
                      <PlanDetail
                        plan={subscription.plan}
                        actionLabel="Manage Subscription"
                        onAction={handleSubscriptionManagement}
                      />
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
