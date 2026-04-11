import { getMeUser } from '@repo/auth-next'

import { checkInAction } from '@repo/bookings-plugin/src/actions/bookings'

import { Timeslot } from '@repo/shared-types'

import { redirect } from 'next/navigation'

import { SaunaPaymentForm } from '@/components/payments/sauna-payment-form'

export default async function BookingPage({ params }: { params: Promise<{ id: number }> }) {
  const { id } = await params

  const { token, user } = await getMeUser({
    nullUserRedirect: `/login?callbackUrl=/bookings/${id}`,
  })

  const response = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/timeslots/${id}?depth=6`, {
    headers: {
      Authorization: `JWT ${token}`,
    },
  })

  const timeslot: Timeslot = await response.json()

  if (timeslot.bookingStatus == 'active' || timeslot.bookingStatus == 'trialable') {
    const checkIn = await checkInAction(id, user.id)

    if (checkIn.success) {
      redirect('/')
    }
  } else {
    redirect('/')
  }

  return (
    <div className="container mx-auto max-w-screen-xl flex flex-col gap-4 px-4 py-8 min-h-[80vh]">
      <SaunaPaymentForm timeslot={timeslot} user={user} />
    </div>
  )
}
