import { getMeUser } from '@repo/auth/src/utils/get-me-user'

import { checkInAction } from '@repo/bookings/src/actions/bookings'

import { Lesson, Plan } from '@repo/shared-types'

import { redirect } from 'next/navigation'

import { BookingSummary } from '@repo/bookings/src/components/ui/booking-summary'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@repo/ui/components/ui/tabs'

import { hasReachedSubscriptionLimit } from '@repo/shared-services'

import { getPayload } from 'payload'

import config from '@payload-config'

export default async function BookingPage({ params }: { params: Promise<{ id: number }> }) {
  const { id } = await params

  const { token, user } = await getMeUser({
    nullUserRedirect: `/login?callbackUrl=/bookings/${id}`,
  })

  const payload = await getPayload({ config })

  //make this a server action with access control
  const response = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/lessons/${id}?depth=5`, {
    headers: {
      Authorization: `JWT ${token}`,
    },
  })

  const lesson: Lesson = await response.json()

  if (lesson.bookingStatus == 'active' || lesson.bookingStatus == 'trialable') {
    const checkIn = await checkInAction(id, user.id)

    if (checkIn.success) {
      redirect('/')
    }
  } else {
    redirect('/')
  }

  const bookingDetails = {
    date: new Date(lesson.date),
    startTime: lesson.startTime,
    endTime: lesson.endTime,
    bookingType: lesson.classOption.name,
    currency: 'EUR',
    maxCapacity: lesson.remainingCapacity,
    currentAttendees:
      lesson.bookings?.docs?.filter((booking) => booking.status === 'confirmed').length || 0,
    adjustableQuantity: lesson.classOption.paymentMethods?.allowedDropIns?.adjustable || false,
  }

  const allowedPlans = lesson.classOption.paymentMethods?.allowedPlans?.filter(
    (plan) => plan.status == 'active',
  )

  //check if user has active subscription

  const subscriptionQuery = await payload.find({
    collection: 'subscriptions',
    where: {
      and: [
        {
          user: {
            equals: user.id,
          },
          endDate: {
            greater_than: new Date(lesson.date).toISOString(),
          },
        },
      ],
    },
    depth: 3,
  })

  const subscription = subscriptionQuery.docs[0]

  return (
    <div className="container mx-auto max-w-screen-sm flex flex-col gap-4 px-4 py-8 min-h-[80vh] pt-24">
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
          {!subscription || !allowedPlans?.includes(subscription.plan as Plan) ? (
            <>
              {subscription && !allowedPlans?.includes(subscription.plan as Plan) && (
                <p>
                  You are membership is not allowed to book this lesson, please upgrade your
                  membership below
                </p>
              )}
              {allowedPlans?.map((plan) => (
                <div key={plan.id}>
                  <h2>{plan.name}</h2>
                </div>
              ))}
            </>
          ) : (
            <>
              {subscription.status == 'unpaid' && <p>Please pay your subscription to continue</p>}
              {(await hasReachedSubscriptionLimit(subscription, payload)) && (
                <p>You have reached your subscription limit, please upgrade to continue</p>
              )}
              <div>
                <h2>Subscription</h2>
                <p>Click here to amend your subscription</p>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
