'use client'

import type { Plan, Subscription } from '@repo/shared-types'
import { PlanView } from '@repo/payments-next'
import { useTRPC } from '@repo/trpc/client'
import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

export function DashboardMembershipPanel({
  plans,
  subscription,
}: {
  plans: Plan[]
  subscription: Subscription | null
}) {
  const trpc = useTRPC()
  const router = useRouter()

  const { mutateAsync: createCheckoutSession } = useMutation(
    trpc.payments.createCustomerCheckoutSession.mutationOptions({
      onSuccess: (session: { url: string | null }) => {
        if (session.url) router.push(session.url)
        else toast.error('Failed to create checkout session')
      },
      onError: (error: { message?: string }) => {
        toast.error(error.message || 'Failed to create checkout session')
      },
    }),
  )

  const { mutateAsync: createCustomerPortal } = useMutation(
    trpc.payments.createCustomerPortal.mutationOptions({
      onSuccess: (session: { url: string | null }) => {
        if (session.url) router.push(session.url)
        else toast.error('Failed to create customer portal')
      },
      onError: (error: { message?: string }) => {
        toast.error(error.message || 'Failed to create customer portal')
      },
    }),
  )

  const handleCreateCheckoutSession = async (
    priceId: string,
    metadata?: { [key: string]: string | undefined },
  ) => {
    const cleanMetadata: Record<string, string> = metadata
      ? Object.fromEntries(
          Object.entries(metadata).filter((entry): entry is [string, string] => entry[1] !== undefined),
        )
      : {}

    const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || ''
    await createCheckoutSession({
      priceId,
      quantity: 1,
      metadata: cleanMetadata,
      mode: 'subscription',
      successUrl: `${baseUrl}/dashboard`,
      cancelUrl: `${baseUrl}/dashboard`,
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
        await createCustomerPortal()
      }}
    />
  )
}


