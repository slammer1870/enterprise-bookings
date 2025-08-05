'use client'

import { useTRPC } from '@repo/trpc'
import { useMutation, useQuery } from '@tanstack/react-query'

import { Plan } from '@repo/shared-types'

import { PlanList } from './plan-list'

export const ManageNoValidSubscription = ({
  allowedPlans,
  lessonId,
}: {
  allowedPlans: Plan[]
  lessonId: number
}) => {
  const trpc = useTRPC()

  const { data } = useQuery(trpc.subscriptions.getSubscription.queryOptions())

  const mutation = useMutation(
    trpc.payments.createCustomerCheckoutSession.mutationOptions({
      onSuccess: (data) => {
        if (data.url) {
          window.location.href = data.url
        }
      },
    }),
  )

  if (!data) {
    return (
      <PlanList
        plans={allowedPlans}
        mutation={mutation}
        actionLabel="Subscribe"
        lessonId={lessonId}
      />
    )
  }

  return <div>Upgrade your subscription</div>
}
