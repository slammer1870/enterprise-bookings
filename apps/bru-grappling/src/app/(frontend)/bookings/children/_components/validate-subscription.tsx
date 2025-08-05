'use client'

import { useTRPC } from '@repo/trpc'
import { useQuery } from '@tanstack/react-query'

import { Subscription } from '@repo/shared-types'

export const ValidateSubscription = ({
  subscription,
  lessonDate,
}: {
  subscription: Subscription
  lessonDate: Date
}) => {
  const trpc = useTRPC()

  const { data } = useQuery(
    trpc.subscriptions.limitReached.queryOptions({
      subscription: {
        plan: {
          id: subscription.plan.id,
          sessionsInformation: subscription.plan.sessionsInformation || undefined,
        },
      },
      lessonDate: lessonDate,
    }),
  )

  if (!data && subscription.status === 'active') {
    return <div>You can book this lesson</div>
  }

  return (
    <div>
      {data && <span>Subscription Limit Reached</span>}
      {subscription.status === 'unpaid' && <span>Unpaid</span>}
      {subscription.status === 'past_due' && <span>Past Due</span>}
      {subscription.status === 'incomplete' && <span>Incomplete</span>}
      {subscription.status === 'incomplete_expired' && <span>Incomplete Expired</span>}
      {subscription.status === 'trialing' && <span>Trialing</span>}
      {subscription.status === 'paused' && <span>Paused</span>}
      {subscription.status === 'canceled' && <span>Canceled</span>}
      <div>Update Payment Method</div>
    </div>
  )
}
