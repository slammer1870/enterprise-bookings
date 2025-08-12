'use client'

import { useParams } from 'next/navigation'

import { useTRPC } from '@repo/trpc'
import { useSuspenseQuery } from '@tanstack/react-query'

import { BookingSummary } from '@repo/bookings/src/components/ui/booking-summary'

import { PaymentGateway } from '@/app/(frontend)/bookings/children/_components/payments/payment-gateway'

import { ChildrensBookingForm } from './childrens-booking-form'
import { ChildBookingDetail } from './child-booking-detail'
import { ManageCurrentBookings } from './bookings/manage-current-bookings'

export const ChildrensBooking = () => {
  const params = useParams()

  const id = params.id as string

  const trpc = useTRPC()

  const { data } = useSuspenseQuery(
    trpc.lessons.getByIdForChildren.queryOptions({ id: parseInt(id) }),
  )

  const hasPaymentMethods = Boolean(
    data?.classOption.paymentMethods?.allowedDropIn ||
      data?.classOption.paymentMethods?.allowedPlans?.length,
  )

  return (
    <div className="flex flex-col gap-4 max-w-2xl mx-auto pt-24 px-4">
      <BookingSummary lesson={data} />
      <ManageCurrentBookings lessonId={data.id} />
      {hasPaymentMethods ? (
        <PaymentGateway
          paymentMethods={data.classOption.paymentMethods}
          lessonDate={new Date(data.date)}
          lessonId={data.id}
          bookingStatus={data.bookingStatus}
          remainingCapacity={data.remainingCapacity}
        />
      ) : (
        <ChildrensBookingForm lessonId={data.id} />
      )}
    </div>
  )
}
