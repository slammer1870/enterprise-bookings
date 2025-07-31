'use client'

import { useTRPC } from '@/trpc/react'
import { BookingSummary } from '@repo/bookings/src/components/ui/booking-summary'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useParams } from 'next/navigation'

import { PaymentGateway } from './payment-gateway'

export const ChildrensBooking = () => {
  const params = useParams()

  const id = params.id as string

  const trpc = useTRPC()

  const { data } = useSuspenseQuery(
    trpc.lessons.getByIdForChildren.queryOptions({ id: parseInt(id) }),
  )

  return (
    <div className="flex flex-col gap-4">
      <BookingSummary lesson={data} />
      <PaymentGateway paymentMethods={data.classOption.paymentMethods} />
    </div>
  )
}
