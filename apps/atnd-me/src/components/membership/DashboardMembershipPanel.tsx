'use client'

import type { Plan, Subscription } from '@repo/shared-types'
import { PlanDetail, PlanList, useSubscriptionActions } from '@repo/membership-next'

export function DashboardMembershipPanel({
  plans,
  subscription,
}: {
  plans: Plan[]
  subscription: Subscription | null
}) {
  const baseUrl =
    process.env.NEXT_PUBLIC_SERVER_URL ||
    (typeof window !== 'undefined' ? window.location.origin : '')
  const { createCheckoutSession, openCustomerPortal } = useSubscriptionActions({
    redirect: 'window',
    baseUrl,
    defaultSuccessPath: '/',
    defaultCancelPath: '/',
  })

  const handleCreateCheckoutSession = async (
    priceId: string,
    metadata?: { [key: string]: string | undefined },
  ) => {
    await createCheckoutSession({
      priceId,
      quantity: 1,
      metadata,
      mode: 'subscription',
    })
  }

  if (!subscription) {
    return (
      <PlanList plans={plans} actionLabel="Subscribe" onAction={handleCreateCheckoutSession} />
    )
  }

  const handleOpenCustomerPortal = async (
    _planId: string,
    _metadata?: { [key: string]: string | undefined },
  ) => {
    await openCustomerPortal()
  }

  return (
    <PlanDetail
      plan={subscription.plan}
      actionLabel="Manage Subscription"
      onAction={handleOpenCustomerPortal}
    />
  )
}
