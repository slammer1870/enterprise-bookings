'use client'

import { useTRPC } from '@repo/trpc'
import { useMutation, useQuery } from '@tanstack/react-query'

import { ClassOption } from '@repo/shared-types'

import { toast } from 'sonner'
import { PaymentTabs } from './payment-tabs'

export const ManageNoValidSubscription = ({
  paymentMethods,
  lessonId,
}: {
  paymentMethods: ClassOption['paymentMethods']
  lessonId: number
}) => {
  const trpc = useTRPC()

  const { data } = useQuery(trpc.subscriptions.getSubscription.queryOptions())

 

  if (!data) {
    return <PaymentTabs paymentMethods={paymentMethods} lessonId={lessonId} />
  }

  return <div>Upgrade your subscription</div>
}
