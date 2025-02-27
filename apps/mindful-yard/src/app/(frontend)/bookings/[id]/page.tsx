import { getMeUser } from '@repo/auth/src/utils/get-me-user'

import { checkInAction } from '@repo/bookings/src/actions/bookings'

import { Lesson } from '@repo/shared-types'

import { redirect } from 'next/navigation'

import { BookingForm } from '@repo/bookings/src/components/ui/booking-form'

export default async function BookingPage({ params }: { params: Promise<{ id: number }> }) {
  const { id } = await params

  const { token, user } = await getMeUser({ nullUserRedirect: '/login' })

  const lesson = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/lessons/${id}?depth=3`, {
    headers: {
      Authorization: `JWT ${token}`,
    },
  })

  const lessonData: Lesson = await lesson.json()

  if (lessonData.bookingStatus === 'booked') {
    redirect('/dashboard')
  }

  const checkIn = await checkInAction(id, user.id)

  if (checkIn.success) {
    redirect('/dashboard')
  }

  return (
    <div className="container mx-auto max-w-screen-sm px-4 py-8">
      <BookingForm lesson={lessonData} name={user.name || ''} />
    </div>
  )
}
