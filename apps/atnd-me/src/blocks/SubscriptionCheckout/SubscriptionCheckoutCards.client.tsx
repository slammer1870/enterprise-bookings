'use client'

import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { useMutation } from '@tanstack/react-query'
import { useTRPC } from '@repo/trpc/client'

import { Button } from '@/components/ui/button'

import { subscriptionCheckoutButtonLabel } from './subscriptionCheckoutButtonLabel'
import { SubscriptionFeeBreakdown } from './SubscriptionFeeBreakdown.client'
import { SubscriptionUpgradeConfirmDialog } from './SubscriptionUpgradeConfirmDialog.client'
import type { UpgradeConfirmPlanSnapshot } from './subscriptionUpgradeConfirmSummary'

export type SubscriptionCheckoutCard = {
  planId: number
  name: string
  description: string | null
  features: string[]
  /** Display names of event types this membership can be used for. */
  eligibleEventTypes: string[]
  priceLabel: string | null
  price: number | null
  priceId: string
  imageUrl: string | null
  imageAlt: string | null
  footerText: string | null
}

export type SubscriptionCheckoutCardsProps = {
  heading?: string | null
  cards: SubscriptionCheckoutCard[]
  tenantId: number
  isLoggedIn: boolean
  /** Payload plan id of the user's active membership on this tenant, if any. */
  activePlanId: number | null
}

const CREATE_CHECKOUT_SESSION_URL = '/api/stripe/connect/create-checkout-session'

export function SubscriptionCheckoutCards({
  heading,
  cards,
  tenantId,
  isLoggedIn,
  activePlanId,
}: SubscriptionCheckoutCardsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const trpc = useTRPC()
  const [busyPlanId, setBusyPlanId] = useState<number | null>(null)
  const [pendingUpgradePlanId, setPendingUpgradePlanId] = useState<number | null>(null)
  const hasActiveSubscription = activePlanId != null

  const toPlanSnapshot = (card: SubscriptionCheckoutCard): UpgradeConfirmPlanSnapshot => ({
    planId: card.planId,
    name: card.name,
    priceLabel: card.priceLabel,
    priceCents: typeof card.price === 'number' ? Math.round(card.price * 100) : null,
    priceId: card.priceId,
  })

  const currentPlanCard =
    activePlanId != null ? (cards.find((c) => c.planId === activePlanId) ?? null) : null
  const pendingUpgradeCard =
    pendingUpgradePlanId != null
      ? (cards.find((c) => c.planId === pendingUpgradePlanId) ?? null)
      : null

  const redirectToPortalUrl = (
    session: { url?: string | null },
    fallbackError: string,
  ) => {
    if (session?.url) {
      window.location.assign(session.url)
      return
    }
    toast.error(fallbackError)
    setBusyPlanId(null)
  }

  const managePortal = useMutation(
    trpc.payments.createCustomerPortal.mutationOptions({
      onSuccess: (session: { url?: string | null }) => {
        redirectToPortalUrl(session, 'Failed to open billing portal')
      },
      onError: (err: { message?: string }) => {
        toast.error(err?.message || 'Failed to open billing portal')
        setBusyPlanId(null)
      },
    }),
  )

  const upgradePortal = useMutation(
    trpc.payments.createCustomerUpgradePortal.mutationOptions({
      onSuccess: (session: { url?: string | null }) => {
        redirectToPortalUrl(session, 'Failed to open subscription upgrade')
      },
      onError: (err: { message?: string }) => {
        toast.error(err?.message || 'Failed to open subscription upgrade')
        setBusyPlanId(null)
      },
    }),
  )

  const currentPath = () =>
    typeof window !== 'undefined'
      ? `${window.location.pathname}${window.location.search || ''}`
      : pathname || '/'

  const requireLogin = () => {
    router.push(`/auth/sign-in?redirectTo=${encodeURIComponent(currentPath())}`)
  }

  const handleSubscribe = async (card: SubscriptionCheckoutCard) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const path = currentPath()

    if (!isLoggedIn) {
      requireLogin()
      return
    }

    setBusyPlanId(card.planId)
    try {
      const response = await fetch(CREATE_CHECKOUT_SESSION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          priceId: card.priceId,
          quantity: 1,
          mode: 'subscription',
          metadata: {
            tenantId: String(tenantId),
            planId: String(card.planId),
          },
          successUrl: `${origin}${path}${path.includes('?') ? '&' : '?'}subscribed=1`,
          cancelUrl: `${origin}${path}`,
        }),
      })

      if (!response.ok) {
        let message = 'Failed to create checkout session'
        try {
          const payload = (await response.json()) as { error?: unknown }
          if (typeof payload?.error === 'string' && payload.error.trim()) {
            message = payload.error
          }
        } catch {
          // ignore parse failures
        }
        throw new Error(message)
      }

      const json = (await response.json()) as { url?: unknown }
      const url = typeof json?.url === 'string' ? json.url : ''
      if (!url) throw new Error('Checkout URL missing')
      window.location.assign(url)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to start checkout')
      setBusyPlanId(null)
    }
  }

  const handleManage = async () => {
    if (!isLoggedIn) {
      requireLogin()
      return
    }

    setBusyPlanId(activePlanId)
    try {
      const returnUrl =
        typeof window !== 'undefined'
          ? `${window.location.origin}${currentPath()}`
          : undefined
      await managePortal.mutateAsync({
        returnUrl,
        tenantId,
      })
    } catch {
      // toast handled in mutation onError
      setBusyPlanId(null)
    }
  }

  const startUpgrade = async (card: SubscriptionCheckoutCard) => {
    setBusyPlanId(card.planId)
    try {
      const returnUrl =
        typeof window !== 'undefined'
          ? `${window.location.origin}${currentPath()}`
          : undefined
      await upgradePortal.mutateAsync({
        planId: card.planId,
        returnUrl,
      })
    } catch {
      // toast handled in mutation onError
      setBusyPlanId(null)
      setPendingUpgradePlanId(null)
    }
  }

  const handleCardAction = async (card: SubscriptionCheckoutCard) => {
    if (!isLoggedIn) {
      requireLogin()
      return
    }

    if (hasActiveSubscription) {
      if (card.planId === activePlanId) {
        await handleManage()
        return
      }
      setPendingUpgradePlanId(card.planId)
      return
    }

    await handleSubscribe(card)
  }

  if (cards.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No purchasable subscriptions are configured for this block.
      </p>
    )
  }

  return (
    <div className="w-full" data-testid="subscription-checkout-block">
      {heading ? (
        <h2 className="mb-8 text-2xl font-semibold tracking-tight text-foreground">
          {heading}
        </h2>
      ) : null}

      <SubscriptionUpgradeConfirmDialog
        open={pendingUpgradeCard != null}
        currentPlan={currentPlanCard ? toPlanSnapshot(currentPlanCard) : null}
        newPlan={pendingUpgradeCard ? toPlanSnapshot(pendingUpgradeCard) : null}
        tenantId={tenantId}
        isConfirming={busyPlanId != null && busyPlanId === pendingUpgradePlanId}
        onCancel={() => {
          if (busyPlanId != null) return
          setPendingUpgradePlanId(null)
        }}
        onConfirm={() => {
          if (!pendingUpgradeCard) return
          void startUpgrade(pendingUpgradeCard)
        }}
      />

      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const isActive = hasActiveSubscription && card.planId === activePlanId
          const isBusy = busyPlanId === card.planId
          const showFee = typeof card.price === 'number' && card.price > 0

          return (
            <li
              key={card.planId}
              className={[
                'flex flex-col overflow-hidden rounded-xl border bg-background',
                isActive
                  ? 'border-foreground ring-2 ring-foreground/20'
                  : 'border-border',
              ].join(' ')}
              data-testid="subscription-checkout-card"
              data-active={isActive ? 'true' : 'false'}
            >
              {card.imageUrl ? (
                <div className="relative aspect-[4/3] w-full bg-muted">
                  <Image
                    src={card.imageUrl}
                    alt={card.imageAlt || card.name}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover"
                  />
                </div>
              ) : null}

              <div className="flex flex-1 flex-col gap-3 p-5">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <h3 className="text-lg font-semibold text-foreground">{card.name}</h3>
                    {isActive ? (
                      <span
                        className="text-xs font-medium uppercase tracking-wide text-foreground"
                        data-testid="subscription-active-badge"
                      >
                        Current membership
                      </span>
                    ) : null}
                  </div>
                  {card.priceLabel ? (
                    <span className="text-base font-semibold tabular-nums whitespace-nowrap">
                      {card.priceLabel}
                    </span>
                  ) : null}
                </div>

                {card.description ? (
                  <p className="text-sm text-muted-foreground">{card.description}</p>
                ) : null}

                {card.features.length > 0 ? (
                  <ul className="list-disc space-y-0.5 pl-4 text-sm text-muted-foreground">
                    {card.features.map((feature) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>
                ) : null}

                {card.eligibleEventTypes.length > 0 ? (
                  <div data-testid="subscription-eligible-event-types">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Eligible for
                    </p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm text-muted-foreground">
                      {card.eligibleEventTypes.map((eventTypeName) => (
                        <li key={eventTypeName}>{eventTypeName}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {showFee ? (
                  <SubscriptionFeeBreakdown priceId={card.priceId} tenantId={tenantId} />
                ) : null}

                {card.footerText ? (
                  <p className="text-xs text-muted-foreground">{card.footerText}</p>
                ) : null}

                <div className="mt-auto pt-2">
                  <Button
                    type="button"
                    className="w-full cursor-pointer"
                    variant={isActive ? 'outline' : 'default'}
                    disabled={busyPlanId != null}
                    onClick={() => void handleCardAction(card)}
                    data-testid={
                      isActive
                        ? 'subscription-manage-button'
                        : hasActiveSubscription
                          ? 'subscription-select-button'
                          : 'subscription-subscribe-button'
                    }
                  >
                    {subscriptionCheckoutButtonLabel({
                      isLoggedIn,
                      hasActiveSubscription,
                      isActivePlan: isActive,
                      isBusy,
                    })}
                  </Button>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
