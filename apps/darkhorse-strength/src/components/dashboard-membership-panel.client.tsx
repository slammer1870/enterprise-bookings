'use client'

import type { Plan, Subscription } from '@repo/shared-types'
import { PlanView } from '@repo/payments-next'
import { useSubscriptionActions } from '@repo/payments-next'

export function DashboardMembershipPanel({
  plans,
  subscription,
}: {
  plans: Plan[]
  subscription: Subscription | null
}) {
  const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || (typeof window !== 'undefined' ? window.location.origin : '')
  const { createCheckoutSession, openCustomerPortal } = useSubscriptionActions({
    redirect: 'window',
    baseUrl,
    defaultSuccessPath: '/dashboard',
    defaultCancelPath: '/dashboard',
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

  return (
    <PlanView
      allowedPlans={plans}
      subscription={subscription}
      lessonDate={new Date()}
      subscriptionLimitReached={false}
      onCreateCheckoutSession={handleCreateCheckoutSession}
      onCreateCustomerPortal={async () => {
        await openCustomerPortal()
      }}
    />
  )
}


