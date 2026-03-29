'use client'

import type { Plan } from '@repo/shared-types'
import { PlanList, PlanDetail, useSubscriptionActions } from '@repo/membership-next'

export function DashboardMemberships({
  allowedPlans,
  subscriptionPlan,
}: {
  allowedPlans: Plan[]
  subscriptionPlan: Plan | null
}) {
  const { createCheckoutSession, openCustomerPortal } = useSubscriptionActions({
    redirect: 'window',
    baseUrl: typeof window !== 'undefined' ? window.location.origin : undefined,
    defaultSuccessPath: '/dashboard',
    defaultCancelPath: '/dashboard',
  })

  const onCheckout = async (priceId: string, metadata?: { [key: string]: string | undefined }) => {
    await createCheckoutSession({
      priceId,
      metadata,
      mode: 'subscription',
      quantity: 1,
    })
  }

  const onPortal = async (_priceId: string) => {
    await openCustomerPortal()
  }

  if (!subscriptionPlan) {
    return <PlanList plans={allowedPlans} actionLabel="Subscribe" onAction={onCheckout} />
  }

  return <PlanDetail plan={subscriptionPlan} actionLabel="Manage Subscription" onAction={onPortal} />
}








