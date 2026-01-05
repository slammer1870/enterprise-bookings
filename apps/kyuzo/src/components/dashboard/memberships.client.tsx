'use client'

import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'

import type { Plan } from '@repo/shared-types'
import { PlanList } from '@repo/memberships/src/components/plans/plan-list'
import { PlanDetail } from '@repo/memberships/src/components/plans/plan-detail'
import { useTRPC } from '@repo/trpc/client'

export function DashboardMemberships({
  allowedPlans,
  subscriptionPlan,
}: {
  allowedPlans: Plan[]
  subscriptionPlan: Plan | null
}) {
  const trpc = useTRPC()

  const checkout = useMutation(
    trpc.payments.createCustomerCheckoutSession.mutationOptions({
      onSuccess: (session: { url?: string | null }) => {
        if (session?.url) {
          window.location.href = session.url
        } else {
          toast.error('Failed to create checkout session')
        }
      },
      onError: (err: any) => {
        toast.error(err?.message || 'Failed to create checkout session')
      },
    }),
  )

  const portal = useMutation(
    trpc.payments.createCustomerPortal.mutationOptions({
      onSuccess: (session: { url?: string | null }) => {
        if (session?.url) {
          window.location.href = session.url
        } else {
          toast.error('Failed to open customer portal')
        }
      },
      onError: (err: any) => {
        toast.error(err?.message || 'Failed to open customer portal')
      },
    }),
  )

  const onCheckout = async (priceId: string) => {
    await checkout.mutateAsync({
      priceId,
      mode: 'subscription',
      quantity: 1,
      successUrl: `${window.location.origin}/dashboard`,
      cancelUrl: `${window.location.origin}/dashboard`,
    })
  }

  const onPortal = async (_priceId: string) => {
    await portal.mutateAsync()
  }

  if (!subscriptionPlan) {
    return <PlanList plans={allowedPlans} actionLabel="Subscribe" onAction={onCheckout} />
  }

  return <PlanDetail plan={subscriptionPlan} actionLabel="Manage Subscription" onAction={onPortal} />
}





