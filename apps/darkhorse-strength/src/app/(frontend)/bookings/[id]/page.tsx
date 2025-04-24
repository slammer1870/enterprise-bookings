import { getMeUser } from '@repo/auth/src/utils/get-me-user'

import { checkInAction } from '@repo/bookings/src/actions/bookings'

import { Lesson } from '@repo/shared-types'

import { redirect } from 'next/navigation'

import { BookingSummary } from '@repo/bookings/src/components/ui/booking-summary'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@repo/ui/components/ui/tabs'

import { getPayload } from 'payload'

import config from '@payload-config'

import { MembershipStatus } from '@repo/memberships/src/components/ui/membership-status'

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

  try {
    const lesson = await getLessonData(id, token)

    // Handle active/trialable status
    if (['active', 'trialable'].includes(lesson.bookingStatus)) {
      const checkIn = await checkInAction(id, user.id)
      if (checkIn.success) {
        redirect('/dashboard')
      }
    } else {
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
      adjustableQuantity: lesson.classOption.paymentMethods?.allowedDropIns?.adjustable || false,
    }

    const allowedPlans = lesson.classOption.paymentMethods?.allowedPlans?.filter(
      (plan) => plan.status === 'active',
    )

    const subscriptionQuery = await getSubscriptionData(payload, user.id)
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
            <MembershipStatus
              subscription={subscription}
              allowedPlans={allowedPlans || []}
              lesson={lesson}
              payload={payload}
            />
          </TabsContent>
        </Tabs>
      </div>
    )
  } catch (error) {
    // Add error handling
    console.error('Error in BookingPage:', error)
    return (
      <div className="container mx-auto max-w-screen-sm px-4 py-8 min-h-[80vh] pt-24">
        <p>Something went wrong. Please try again later.</p>
      </div>
    )
  }
}
