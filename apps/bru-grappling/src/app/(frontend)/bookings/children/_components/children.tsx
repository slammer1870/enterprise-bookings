'use client'

import { useParams } from 'next/navigation'

import { useTRPC } from '@repo/trpc'
import { useSuspenseQuery } from '@tanstack/react-query'

import { BookingSummary } from '@repo/bookings/src/components/ui/booking-summary'

import { PaymentGateway } from './payment-gateway'

export const ChildrensBooking = () => {
  const params = useParams()

  const id = params.id as string

  const trpc = useTRPC()

  const { data } = useSuspenseQuery(
    trpc.lessons.getByIdForChildren.queryOptions({ id: parseInt(id) }),
  )

  return (
    <div className="flex flex-col gap-4 max-w-2xl mx-auto pt-24">
      <BookingSummary lesson={data} />
      <PaymentGateway
        paymentMethods={data.classOption.paymentMethods}
        lessonDate={new Date(data.date)}
      />
    </div>
  )
}
