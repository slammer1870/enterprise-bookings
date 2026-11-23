'use client'

import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { ClassPassFeeBreakdown } from '@/components/payments/ClassPassFeeBreakdown.client'

export type ClassPassCheckoutCard = {
  classPassTypeId: number
  name: string
  description: string | null
  quantity: number
  daysUntilExpiration: number | null
  price: number | null
  priceId: string
  imageUrl: string | null
  imageAlt: string | null
  /** Display names of event types this pass can be used for. */
  eligibleEventTypes: string[]
}

export type ClassPassCheckoutCardsProps = {
  heading?: string | null
  cards: ClassPassCheckoutCard[]
  tenantId: number
  isLoggedIn: boolean
}

const CREATE_CHECKOUT_SESSION_URL = '/api/stripe/connect/create-checkout-session'

export function ClassPassCheckoutCards({
  heading,
  cards,
  tenantId,
  isLoggedIn,
}: ClassPassCheckoutCardsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [purchasingId, setPurchasingId] = useState<number | null>(null)

  const handlePurchase = async (card: ClassPassCheckoutCard) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const currentPath =
      typeof window !== 'undefined'
        ? `${window.location.pathname}${window.location.search || ''}`
        : pathname || '/'

    if (!isLoggedIn) {
      router.push(`/auth/sign-in?redirectTo=${encodeURIComponent(currentPath)}`)
      return
    }

    setPurchasingId(card.classPassTypeId)
    try {
      const response = await fetch(CREATE_CHECKOUT_SESSION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          priceId: card.priceId,
          quantity: 1,
          mode: 'payment',
          metadata: {
            type: 'class_pass_purchase',
            classPassTypeId: String(card.classPassTypeId),
            tenantId: String(tenantId),
          },
          successUrl: `${origin}/class-passes?purchased=1`,
          cancelUrl: `${origin}${currentPath}`,
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
      setPurchasingId(null)
    }
  }

  if (cards.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No purchasable class passes are configured for this block.
      </p>
    )
  }

  return (
    <div className="w-full" data-testid="class-pass-checkout-block">
      {heading ? (
        <h2 className="mb-8 text-2xl font-semibold tracking-tight text-foreground">
          {heading}
        </h2>
      ) : null}

      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const isPurchasing = purchasingId === card.classPassTypeId
          const priceCents =
            typeof card.price === 'number' && card.price > 0
              ? Math.round(card.price * 100)
              : null

          return (
            <li
              key={card.classPassTypeId}
              className="flex flex-col overflow-hidden rounded-xl border border-border bg-background"
              data-testid="class-pass-checkout-card"
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
                  <h3 className="text-lg font-semibold text-foreground">{card.name}</h3>
                  {card.price != null ? (
                    <span className="text-base font-semibold tabular-nums">
                      €{card.price.toFixed(2)}
                    </span>
                  ) : null}
                </div>

                {card.description ? (
                  <p className="text-sm text-muted-foreground">{card.description}</p>
                ) : null}

                <p className="text-sm text-muted-foreground">
                  {card.quantity} credit{card.quantity === 1 ? '' : 's'}
                  {card.daysUntilExpiration != null
                    ? ` · valid ${card.daysUntilExpiration} day${card.daysUntilExpiration === 1 ? '' : 's'}`
                    : null}
                </p>

                {card.eligibleEventTypes.length > 0 ? (
                  <div data-testid="class-pass-eligible-event-types">
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

                {priceCents != null ? (
                  <ClassPassFeeBreakdown
                    classPassTypeId={card.classPassTypeId}
                    classPriceCents={priceCents}
                  />
                ) : null}

                <div className="mt-auto pt-2">
                  <Button
                    type="button"
                    className="w-full cursor-pointer"
                    disabled={purchasingId != null}
                    onClick={() => void handlePurchase(card)}
                    data-testid="class-pass-purchase-button"
                  >
                    {isPurchasing
                      ? 'Starting checkout…'
                      : isLoggedIn
                        ? 'Purchase'
                        : 'Sign in to purchase'}
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
