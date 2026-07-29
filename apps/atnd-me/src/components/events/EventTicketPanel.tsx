'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { CheckoutForm } from '@repo/payments-next'
import { QuantitySelector } from '@repo/bookings-next'
import type { DiscountTier, Timeslot } from '@repo/shared-types'
import { BookingFeeBreakdown } from '@/components/booking/BookingFeeBreakdown'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { calculateQuantityDiscount } from '@repo/shared-utils'
import { releaseGuestCheckoutHold } from '@/lib/booking/releaseGuestCheckoutHold'

type DropInLike = {
  price?: number | null
  maxBookingsPerTimeslot?: number | null
  discountTiers?: DiscountTier[] | null
}

type EventTicketPanelProps = {
  timeslot: Timeslot
  dropIn: DropInLike
  remainingCapacity: number
  isAuthenticated: boolean
  isPast: boolean
  successUrl?: string
  AuthenticatedCheckout?: React.ComponentType<{
    timeslot: Timeslot
    quantity: number
    successUrl?: string
  }>
}

/** Require a real mailbox shape so typing `sam@` / `sam@ex` does not start checkout holds. */
function isCompleteGuestEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

function placesLabel(remaining: number): string {
  if (remaining <= 0) return 'Sold out'
  if (remaining === 1) return '1 place left'
  return `${remaining} places left`
}

export function EventTicketPanel({
  timeslot,
  dropIn,
  remainingCapacity,
  isAuthenticated,
  isPast,
  successUrl = '/success',
  AuthenticatedCheckout,
}: EventTicketPanelProps) {
  const unitPrice = typeof dropIn.price === 'number' ? dropIn.price : 0
  const maxFromDropIn =
    dropIn.maxBookingsPerTimeslot == null
      ? Infinity
      : Math.max(1, Number(dropIn.maxBookingsPerTimeslot) || 1)
  const maxQuantity = Math.max(
    1,
    Math.min(
      Math.max(0, remainingCapacity),
      maxFromDropIn === Infinity ? remainingCapacity : maxFromDropIn,
    ),
  )

  const [quantity, setQuantity] = useState(1)
  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  /**
   * Locked identity after Continue. CheckoutForm / guest get-or-create only run for these
   * values — not while typing `sam@execbjj.c` → `.co` → `.com`.
   */
  const [settledGuest, setSettledGuest] = useState<{ name: string; email: string } | null>(null)
  const [guestFormError, setGuestFormError] = useState<string | null>(null)
  const [feeBreakdown, setFeeBreakdown] = useState<{
    classPriceCents: number
    bookingFeeCents: number
    totalCents: number
  } | null>(null)
  const paymentRedirectInProgressRef = useRef(false)

  useEffect(() => {
    if (quantity > maxQuantity) setQuantity(Math.max(1, maxQuantity))
  }, [maxQuantity, quantity])

  // Release guest hold on refresh / tab close / navigate away / abandoning Continue.
  // Unload must use sync XHR — see releaseGuestCheckoutHold + unit tests.
  useEffect(() => {
    if (!settledGuest) return

    const timeslotId = timeslot.id
    const guestEmail = settledGuest.email

    const releaseViaApi = (sync = false) => {
      releaseGuestCheckoutHold({
        timeslotId,
        guestEmail,
        sync,
        skip: paymentRedirectInProgressRef.current,
      })
    }

    const handlePageExit = () => releaseViaApi(true)

    window.addEventListener('pagehide', handlePageExit)
    window.addEventListener('beforeunload', handlePageExit)

    return () => {
      window.removeEventListener('pagehide', handlePageExit)
      window.removeEventListener('beforeunload', handlePageExit)
      releaseViaApi(false)
    }
  }, [settledGuest, timeslot.id])

  const pricing = useMemo(
    () =>
      calculateQuantityDiscount(
        unitPrice,
        quantity,
        Array.isArray(dropIn.discountTiers) ? dropIn.discountTiers : [],
      ),
    [dropIn.discountTiers, quantity, unitPrice],
  )

  const classPrice = pricing.totalAmount
  const classPriceCents = Math.round(classPrice * 100)

  useEffect(() => {
    if (isPast || remainingCapacity <= 0 || unitPrice <= 0) {
      setFeeBreakdown(null)
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/events/fee-breakdown', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({ timeslotId: timeslot.id, classPriceCents }),
        })
        if (!res.ok) return
        const data = (await res.json()) as {
          classPriceCents: number
          bookingFeeCents: number
          totalCents: number
        }
        setFeeBreakdown(data)
      } catch {
        // ignore abort / network
      }
    }, 200)
    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [classPriceCents, isPast, remainingCapacity, timeslot.id, unitPrice])

  const canContinue =
    guestName.trim().length >= 2 && isCompleteGuestEmail(guestEmail.trim())

  const handleGuestFieldChange = (field: 'name' | 'email', value: string) => {
    if (field === 'name') setGuestName(value)
    else setGuestEmail(value)
    // Editing after Continue must re-confirm so progressive TLDs never create users.
    if (settledGuest) setSettledGuest(null)
    if (guestFormError) setGuestFormError(null)
  }

  const handleContinueToPayment = (e: React.FormEvent) => {
    e.preventDefault()
    const name = guestName.trim()
    const email = guestEmail.trim().toLowerCase()
    if (name.length < 2) {
      setGuestFormError('Enter your name to continue.')
      return
    }
    if (!isCompleteGuestEmail(email)) {
      setGuestFormError('Enter a complete email address (for example you@example.com).')
      return
    }
    setGuestFormError(null)
    setSettledGuest({ name, email })
  }

  const soldOut = remainingCapacity <= 0
  const emphasizeRemaining = remainingCapacity > 0 && remainingCapacity <= 6

  if (isPast) {
    return (
      <aside
        className="rounded-xl border border-border bg-card p-5 shadow-sm"
        data-testid="event-ticket-panel"
      >
        <h2 className="text-lg font-semibold text-foreground">Get tickets</h2>
        <p className="mt-2 text-sm text-muted-foreground">Past event</p>
      </aside>
    )
  }

  if (soldOut) {
    return (
      <aside
        className="rounded-xl border border-border bg-card p-5 shadow-sm"
        data-testid="event-ticket-panel"
      >
        <h2 className="text-lg font-semibold text-foreground">Get tickets</h2>
        <p className="mt-2 text-sm font-medium text-destructive">Sold out</p>
      </aside>
    )
  }

  if (unitPrice <= 0) {
    return (
      <aside
        className="rounded-xl border border-border bg-card p-5 shadow-sm"
        data-testid="event-ticket-panel"
      >
        <h2 className="text-lg font-semibold text-foreground">Get tickets</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Drop-in purchase is not configured for this event.
        </p>
      </aside>
    )
  }

  return (
    <aside
      className="rounded-xl border border-border bg-card p-5 shadow-sm"
      data-testid="event-ticket-panel"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">Get tickets</h2>
        <p className="text-xl font-semibold text-foreground">€{unitPrice.toFixed(2)}</p>
      </div>

      <p
        className={`mt-2 text-sm ${emphasizeRemaining ? 'font-medium text-amber-700 dark:text-amber-400' : 'text-muted-foreground'}`}
        data-testid="event-places-remaining"
      >
        {placesLabel(remainingCapacity)}
      </p>

      <div className="mt-4">
        <QuantitySelector
          timeslot={{ ...timeslot, remainingCapacity: maxQuantity } as Timeslot}
          quantity={quantity}
          onQuantityChange={setQuantity}
          maxQuantity={maxQuantity}
        />
      </div>

      {feeBreakdown && !isAuthenticated ? (
        <div className="mt-4">
          <BookingFeeBreakdown
            classPriceCents={feeBreakdown.classPriceCents}
            bookingFeeCents={feeBreakdown.bookingFeeCents}
          />
        </div>
      ) : null}

      {isAuthenticated && AuthenticatedCheckout ? (
        <div className="mt-4">
          <AuthenticatedCheckout timeslot={timeslot} quantity={quantity} successUrl={successUrl} />
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <form className="space-y-4" onSubmit={handleContinueToPayment}>
            <div className="space-y-2">
              <Label htmlFor="guest-name">Name</Label>
              <Input
                id="guest-name"
                name="guestName"
                autoComplete="name"
                value={guestName}
                onChange={(e) => handleGuestFieldChange('name', e.target.value)}
                placeholder="Your name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="guest-email">Email</Label>
              <Input
                id="guest-email"
                name="guestEmail"
                type="email"
                autoComplete="email"
                value={guestEmail}
                onChange={(e) => handleGuestFieldChange('email', e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>

            {guestFormError ? (
              <p className="text-sm text-destructive" role="alert">
                {guestFormError}
              </p>
            ) : null}

            {!settledGuest ? (
              <Button
                type="submit"
                className="w-full"
                disabled={!canContinue}
                data-testid="guest-checkout-continue"
              >
                Continue to payment
              </Button>
            ) : null}
          </form>

          {settledGuest ? (
            <CheckoutForm
              price={classPrice}
              priceComponent={
                <div className="my-2 text-lg font-medium">
                  Total: €{((feeBreakdown?.totalCents ?? classPriceCents) / 100).toFixed(2)}
                </div>
              }
              createPaymentIntentUrl="/api/events/guest-checkout"
              returnUrl={successUrl}
              onPaymentRedirectStart={() => {
                paymentRedirectInProgressRef.current = true
              }}
              metadata={{
                timeslotId: String(timeslot.id),
                quantity: String(quantity),
                guestName: settledGuest.name,
                guestEmail: settledGuest.email,
              }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Enter your details, then continue when your email is complete.
            </p>
          )}
        </div>
      )}
    </aside>
  )
}
