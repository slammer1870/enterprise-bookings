'use client'

import { useTRPC } from '@repo/trpc'
import { useMutation, useQuery } from '@tanstack/react-query'

import { Subscription } from '@repo/shared-types'
import { PlanDetail } from './plan-detail'
import { ChildrensBookingForm } from './childrens-booking-form'

const getSubscriptionMessage = (status: string, hasLimitReached: boolean) => {
  if (hasLimitReached) {
    return "You've reached your session limit for this billing period. Upgrade your plan or wait for the next billing cycle to book more sessions."
  }

  switch (status) {
    case 'unpaid':
      return 'Your subscription payment is overdue. Please update your payment method to continue booking sessions.'
    case 'past_due':
      return 'Your subscription payment failed. Please update your payment method to avoid service interruption.'
    case 'incomplete':
      return 'Your subscription setup is incomplete. Please complete the payment process to start booking sessions.'
    case 'incomplete_expired':
      return 'Your subscription setup has expired. Please restart the subscription process to book sessions.'
    case 'trialing':
      return "You're currently in a trial period. Complete your payment setup to continue after the trial ends."
    case 'paused':
      return 'Your subscription is temporarily paused. Reactivate it to resume booking sessions.'
    case 'canceled':
      return 'Your subscription has been canceled. You can resubscribe at any time to continue booking sessions.'
    default:
      return "There's an issue with your subscription. Please contact support for assistance."
  }
}

export const ValidateSubscription = ({
  subscription,
  lessonDate,
  lessonId,
}: {
  subscription: Subscription
  lessonDate: Date
  lessonId: number
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

  const { mutate: createCustomerPortal } = useMutation(
    trpc.payments.createCustomerPortal.mutationOptions({
      onSuccess: (data) => {
        window.location.href = data.url
      },
    }),
  )

  if (!data && subscription.status === 'active') {
    return <ChildrensBookingForm lessonId={lessonId} />
  }

  const message = getSubscriptionMessage(subscription.status, !!data)

  return (
    <div>
      <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
        <p className="text-orange-800 font-medium">Subscription Issue</p>
        <p className="text-orange-700 text-sm mt-1">{message}</p>
      </div>
      <PlanDetail
        plan={subscription.plan}
        actionLabel="Update Subscription"
        handleAction={createCustomerPortal}
        loading={false}
      />
    </div>
  )
}
