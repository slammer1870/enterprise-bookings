'use client'

import { useTRPC } from '@repo/trpc/client'
import { useMutation, useQuery } from '@tanstack/react-query'

import { Plan } from '@repo/shared-types'

import { PlanList } from './plan-list'

export const ManageNoValidSubscription = ({ allowedPlans }: { allowedPlans: Plan[] }) => {
  const trpc = useTRPC()

  const { data } = useQuery(trpc.subscriptions.getSubscription.queryOptions())

  const mutation = useMutation(
    trpc.payments.createSubscriptionCheckoutSession.mutationOptions({
      onSuccess: (data) => {
        if (data.url) {
          window.location.href = data.url
        }
      },
    }),
  )

  if (!data) {
    return <PlanList plans={allowedPlans} mutation={mutation} />
  }

  return <div>Upgrade your subscription</div>
}
