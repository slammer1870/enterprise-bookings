'use client'

import { useTRPC } from '@repo/trpc/client'
import { Plan } from '@repo/shared-types'
import { useQuery } from '@tanstack/react-query'

export const ManageNoValidSubscription = ({ allowedPlans }: { allowedPlans: Plan[] }) => {
  const trpc = useTRPC()

  const { data } = useQuery(trpc.subscriptions.getSubscription.queryOptions())

  if (!data) {
    return <div>List of plans</div>
  }

  return <div>Upgrade your subscription</div>
}
