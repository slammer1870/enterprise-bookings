'use client'

import { useTRPC } from '@repo/trpc'
import { useSuspenseQuery } from '@tanstack/react-query'
import { ClassOption, Lesson } from '@repo/shared-types'

import { ValidateSubscription } from '../validate-subscription'
import { ManageNoValidSubscription } from '../manage-no-valid-subscription'

export const PaymentGateway = ({
  paymentMethods,
  lessonDate,
  lessonId,
  bookingStatus,
  remainingCapacity,
}: {
  paymentMethods?: ClassOption['paymentMethods']
  lessonDate: Date
  lessonId: number
  bookingStatus: Lesson['bookingStatus']
  remainingCapacity: number
}) => {
  const trpc = useTRPC()

  const { data } = useSuspenseQuery(
    trpc.subscriptions.hasValidSubscription.queryOptions({
      plans: paymentMethods?.allowedPlans?.map((plan) => plan.id) || [],
    }),
  )

  if (!data) {
    return (
      <ManageNoValidSubscription
        paymentMethods={paymentMethods}
        lessonId={lessonId}
        bookingStatus={bookingStatus}
        remainingCapacity={remainingCapacity}
      />
    )
  }

  return <ValidateSubscription subscription={data} lessonDate={lessonDate} lessonId={lessonId} />
}
