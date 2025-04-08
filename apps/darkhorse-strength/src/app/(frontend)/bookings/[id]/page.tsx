import { getMeUser } from '@repo/auth/src/utils/get-me-user'

import { checkInAction } from '@repo/bookings/src/actions/bookings'

import { Lesson } from '@repo/shared-types'

import { redirect } from 'next/navigation'

import { BookingSummary } from '@repo/bookings/src/components/ui/booking-summary'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@repo/ui/components/ui/tabs'

import { hasActiveSubscription } from '@repo/shared-services'

export default async function BookingPage({ params }: { params: Promise<{ id: number }> }) {
  const { id } = await params

  const { token, user } = await getMeUser({
    nullUserRedirect: `/login?callbackUrl=/bookings/${id}`,
  })

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

  //check if user has active subscription

  return (
    <div className="container mx-auto max-w-screen-sm flex flex-col gap-4 px-4 py-8 min-h-[80vh] pt-24">
      <BookingSummary bookingDetails={bookingDetails} attendeesCount={1} />
      <Tabs defaultValue="membership">
        <TabsList className="flex w-full justify-around gap-4">
          <TabsTrigger value="membership" className="w-full">
            Membership
          </TabsTrigger>
        </TabsList>
        <TabsContent value="membership">
          <p>Membership</p>
        </TabsContent>
      </Tabs>
    </div>
  )
}
