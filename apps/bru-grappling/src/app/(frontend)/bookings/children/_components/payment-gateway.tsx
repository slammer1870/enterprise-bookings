'use client'

import { useTRPC } from '@repo/trpc'
import { useSuspenseQuery } from '@tanstack/react-query'
import { ClassOption } from '@repo/shared-types'

import { ValidateSubscription } from './validate-subscription'
import { ManageNoValidSubscription } from './manage-no-valid-subscription'

export const PaymentGateway = ({
  paymentMethods,
  lessonDate,
}: {
  paymentMethods: ClassOption['paymentMethods']
  lessonDate: Date
}) => {
  const trpc = useTRPC()

  const { data } = useSuspenseQuery(
    trpc.subscriptions.hasValidSubscription.queryOptions({
      plans: paymentMethods?.allowedPlans?.map((plan) => plan.id) || [],
    }),
  )

  if (!data) {
    return <ManageNoValidSubscription allowedPlans={paymentMethods?.allowedPlans || []} />
  }

  return <ValidateSubscription subscription={data} lessonDate={lessonDate} />
}
