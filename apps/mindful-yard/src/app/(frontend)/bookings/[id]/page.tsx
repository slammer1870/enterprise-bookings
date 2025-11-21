import { getMeUser } from '@repo/auth'

import { checkInAction } from '@repo/bookings-plugin/src/actions/bookings'

import { Lesson } from '@repo/shared-types'

import { redirect } from 'next/navigation'

import { SaunaPaymentForm } from '@/components/payments/sauna-payment-form'

export default async function BookingPage({ params }: { params: Promise<{ id: number }> }) {
  const { id } = await params

  const { token, user } = await getMeUser({
    nullUserRedirect: `/login?callbackUrl=/bookings/${id}`,
  })

  const response = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/lessons/${id}?depth=6`, {
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

  return (
    <div className="container mx-auto max-w-screen-xl flex flex-col gap-4 px-4 py-8 min-h-[80vh]">
      <SaunaPaymentForm lesson={lesson} user={user} />
    </div>
  )
}
