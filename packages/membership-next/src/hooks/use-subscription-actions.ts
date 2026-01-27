'use client'

import { useTRPC } from '@repo/trpc/client'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'

export type SubscriptionActionsRedirect = 'window' | 'router'

export type CheckoutArgs = {
  priceId: string
  quantity?: number
  mode?: 'subscription' | 'payment'
  metadata?: Record<string, string | undefined>
  successUrl?: string
  cancelUrl?: string
}

export type UseSubscriptionActionsOptions = {
  redirect?: SubscriptionActionsRedirect
  baseUrl?: string
  defaultSuccessPath?: string
  defaultCancelPath?: string
}

function resolveBaseUrl(explicit?: string) {
  if (explicit) return explicit
  const env = process.env.NEXT_PUBLIC_SERVER_URL
  if (env) return env
  if (typeof window !== 'undefined') return window.location.origin
  return ''
}

function cleanMetadata(metadata?: Record<string, string | undefined>) {
  if (!metadata) return undefined
  return Object.fromEntries(
    Object.entries(metadata).filter((entry): entry is [string, string] => entry[1] !== undefined),
  )
}

export function useSubscriptionActions(options: UseSubscriptionActionsOptions = {}) {
  const trpc = useTRPC()

  const redirect = options.redirect ?? 'window'
  const baseUrl = resolveBaseUrl(options.baseUrl)
  const defaultSuccessUrl = `${baseUrl}${options.defaultSuccessPath ?? '/dashboard'}`
  const defaultCancelUrl = `${baseUrl}${options.defaultCancelPath ?? '/dashboard'}`

  const checkout = useMutation(
    trpc.payments.createCustomerCheckoutSession.mutationOptions({
      onSuccess: (session: { url?: string | null }) => {
        if (session?.url) {
          if (redirect === 'window') window.location.href = session.url
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
          if (redirect === 'window') window.location.href = session.url
        } else {
          toast.error('Failed to open customer portal')
        }
      },
      onError: (err: any) => {
        toast.error(err?.message || 'Failed to open customer portal')
      },
    }),
  )

  const createCheckoutSession = async (args: CheckoutArgs) => {
    const {
      priceId,
      quantity = 1,
      mode = 'subscription',
      metadata,
      successUrl = defaultSuccessUrl,
      cancelUrl = defaultCancelUrl,
    } = args

    await checkout.mutateAsync({
      priceId,
      quantity,
      mode,
      metadata: cleanMetadata(metadata),
      successUrl,
      cancelUrl,
    })
  }

  const openCustomerPortal = async () => {
    await portal.mutateAsync()
  }

  return {
    checkoutPending: checkout.isPending,
    portalPending: portal.isPending,
    createCheckoutSession,
    openCustomerPortal,
  }
}
