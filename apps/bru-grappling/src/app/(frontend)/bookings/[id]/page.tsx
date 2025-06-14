import { getMeUser } from '@repo/auth/src/utils/get-me-user'

import { checkInAction } from '@repo/bookings/src/actions/bookings'

import { Lesson, Subscription } from '@repo/shared-types'

import { redirect } from 'next/navigation'

import { BookingSummary } from '@repo/bookings/src/components/ui/booking-summary'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@repo/ui/components/ui/tabs'

import { getPayload } from 'payload'

import config from '@payload-config'

import { hasReachedSubscriptionLimit } from '@repo/shared-services'

import { PlanView } from '@repo/memberships/src/components/plans/plan-view'
// Add these new types
type BookingPageProps = {
  params: Promise<{ id: number }>
}

// Extract booking details type
type BookingDetails = {
  date: Date
  startTime: string
  endTime: string
  bookingType: string
  currency: string
  maxCapacity: number
  currentAttendees: number
  adjustableQuantity: boolean
}

export default async function BookingPage({ params }: BookingPageProps) {
  const { id } = await params

  // Auth check
  const { token, user } = await getMeUser({
    nullUserRedirect: `/login?callbackUrl=/bookings/${id}`,
  })

  const payload = await getPayload({ config })

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

  if (lesson.bookingStatus === 'booked') {
    redirect('/dashboard')
  }

  // Handle active/trialable status
  if (['active', 'trialable'].includes(lesson.bookingStatus)) {
    const checkIn = await checkInAction(lesson.id, user.id)
    if (checkIn.success) {
      redirect('/dashboard')
    }
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

  const subscription = subscriptionQuery.docs[0] as Subscription | undefined

  const handlePlanPurchase = async (
    planId: string,
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

  const subscriptionLimitReached = subscription
    ? await hasReachedSubscriptionLimit(subscription, payload, new Date(lesson.startTime))
    : false

  return (
    <div className="container mx-auto max-w-screen-sm flex flex-col gap-4 px-4 py-8 min-h-screen pt-24">
      <BookingSummary bookingDetails={bookingDetails} attendeesCount={1} />
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
          <PlanView
            allowedPlans={allowedPlans}
            subscription={subscription}
            hasReachedSubscriptionLimit={subscriptionLimitReached}
            handlePlanPurchase={handlePlanPurchase}
            handleSubscriptionManagement={handleSubscriptionManagement}
            lessonDate={new Date(lesson.startTime)}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
