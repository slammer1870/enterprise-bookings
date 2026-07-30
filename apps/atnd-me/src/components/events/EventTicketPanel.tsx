'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CheckoutForm } from '@repo/payments-next'
import { QuantitySelector } from '@repo/bookings-next'
import type { DiscountTier, Timeslot } from '@repo/shared-types'
import { BookingFeeBreakdown } from '@/components/booking/BookingFeeBreakdown'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { calculateQuantityDiscount } from '@repo/shared-utils'
import { releaseGuestCheckoutHold } from '@/lib/booking/releaseGuestCheckoutHold'
import {
  eventPlacesAvailability,
  eventPlacesLabel,
  guestCheckoutHoldStorageKey,
  type StoredGuestCheckout,
} from '@/components/events/eventPlacesAvailability'

type DropInLike = {
  price?: number | null
  maxBookingsPerTimeslot?: number | null
  discountTiers?: DiscountTier[] | null
}

type EventTicketPanelProps = {
  timeslot: Timeslot
  dropIn: DropInLike
  remainingCapacity: number
  /** places − confirmed; hard sold-out when <= 0. Defaults to remainingCapacity. */
  remainingConfirmedOnly?: number
  /** Server-known hold for authenticated viewers. */
  initialOwnHoldQuantity?: number
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

function newCheckoutSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function readStoredGuestCheckout(timeslotId: number): StoredGuestCheckout | null {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(guestCheckoutHoldStorageKey(timeslotId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredGuestCheckout>
    if (
      typeof parsed.name !== 'string' ||
      typeof parsed.email !== 'string' ||
      !isCompleteGuestEmail(parsed.email)
    ) {
      return null
    }
    return {
      name: parsed.name.trim(),
      email: parsed.email.trim().toLowerCase(),
      quantity: Math.max(1, Number(parsed.quantity) || 1),
      ownHoldQuantity: Math.max(0, Number(parsed.ownHoldQuantity) || 0),
    }
  } catch {
    return null
  }
}

function writeStoredGuestCheckout(timeslotId: number, value: StoredGuestCheckout | null) {
  if (typeof sessionStorage === 'undefined') return
  const key = guestCheckoutHoldStorageKey(timeslotId)
  if (!value) {
    sessionStorage.removeItem(key)
    return
  }
  sessionStorage.setItem(key, JSON.stringify(value))
}

export function EventTicketPanel({
  timeslot,
  dropIn,
  remainingCapacity,
  remainingConfirmedOnly: remainingConfirmedOnlyProp,
  initialOwnHoldQuantity = 0,
  isAuthenticated,
  isPast,
  successUrl = '/success',
  AuthenticatedCheckout,
}: EventTicketPanelProps) {
  const remainingConfirmedOnly =
    typeof remainingConfirmedOnlyProp === 'number'
      ? remainingConfirmedOnlyProp
      : remainingCapacity

  const unitPrice = typeof dropIn.price === 'number' ? dropIn.price : 0
  const maxFromDropIn =
    dropIn.maxBookingsPerTimeslot == null
      ? Infinity
      : Math.max(1, Number(dropIn.maxBookingsPerTimeslot) || 1)

  const [quantity, setQuantity] = useState(1)
  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  /**
   * Locked identity after Continue. CheckoutForm / guest get-or-create only run for these
   * values — not while typing `sam@execbjj.c` → `.co` → `.com`.
   */
  const [settledGuest, setSettledGuest] = useState<{
    name: string
    email: string
    checkoutSessionId: string
  } | null>(null)
  const [ownHoldQuantity, setOwnHoldQuantity] = useState(() => {
    const fromServer = Math.max(0, initialOwnHoldQuantity)
    if (fromServer > 0 || isAuthenticated) return fromServer
    const saved = readStoredGuestCheckout(timeslot.id)
    if (!saved || saved.ownHoldQuantity <= 0) return 0
    // Only count a stored guest hold when SSR remaining already looks like it includes
    // someone's hold. If pagehide released before SSR, remaining === confirmed-only and
    // adding the stored qty would inflate the label until re-reserve returns.
    const heldByAnyone = Math.max(0, remainingConfirmedOnly - remainingCapacity)
    return heldByAnyone >= saved.ownHoldQuantity ? saved.ownHoldQuantity : 0
  })
  /** Global free spots (everyone's holds subtracted). Synced from SSR + reserve responses. */
  const [globalRemaining, setGlobalRemaining] = useState(() => Math.max(0, remainingCapacity))
  const [guestFormError, setGuestFormError] = useState<string | null>(null)
  const [isReserving, setIsReserving] = useState(false)
  const [feeBreakdown, setFeeBreakdown] = useState<{
    classPriceCents: number
    bookingFeeCents: number
    totalCents: number
  } | null>(null)
  const paymentRedirectInProgressRef = useRef(false)
  /** Bumped on exit so in-flight reserve upserts after leave are rolled back client-side. */
  const checkoutAttemptRef = useRef(0)
  const didRestoreRef = useRef(false)
  /** Shares one in-flight reserve across Continue, restore, and CheckoutForm. */
  const reserveInFlightRef = useRef<Promise<void> | null>(null)
  const lastReservedQtyRef = useRef(0)

  useEffect(() => {
    setGlobalRemaining(Math.max(0, remainingCapacity))
  }, [remainingCapacity])

  const availability = eventPlacesAvailability({
    remainingCapacity: globalRemaining,
    remainingConfirmedOnly,
    ownHoldQuantity,
  })
  const viewerRemaining = availability.viewerRemaining

  const maxQuantity = Math.max(
    1,
    Math.min(
      Math.max(viewerRemaining, ownHoldQuantity, 1),
      maxFromDropIn === Infinity
        ? Math.max(viewerRemaining, ownHoldQuantity, 1)
        : maxFromDropIn,
    ),
  )

  useEffect(() => {
    setOwnHoldQuantity((prev) => Math.max(prev, Math.max(0, initialOwnHoldQuantity)))
  }, [initialOwnHoldQuantity])

  useEffect(() => {
    if (quantity > maxQuantity) setQuantity(Math.max(1, maxQuantity))
  }, [maxQuantity, quantity])

  const applyReserveSuccess = useCallback(
    (qty: number, remainingFromApi?: number) => {
      setOwnHoldQuantity(qty)
      lastReservedQtyRef.current = qty
      if (typeof remainingFromApi === 'number' && Number.isFinite(remainingFromApi)) {
        setGlobalRemaining(Math.max(0, remainingFromApi))
      }
    },
    [],
  )

  const postGuestReserve = useCallback(
    async (opts: {
      name: string
      email: string
      checkoutSessionId: string
      quantity: number
    }): Promise<{
      holdId?: string
      abandoned?: boolean
      error?: string
      remainingCapacity?: number
    }> => {
      const previous = reserveInFlightRef.current
      let releaseInFlight!: () => void
      const gate = new Promise<void>((resolve) => {
        releaseInFlight = resolve
      })
      reserveInFlightRef.current = gate

      try {
        if (previous) await previous.catch(() => undefined)

        const res = await fetch('/api/events/guest-reserve-hold', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            timeslotId: timeslot.id,
            quantity: opts.quantity,
            guestName: opts.name,
            guestEmail: opts.email,
            checkoutSessionId: opts.checkoutSessionId,
          }),
        })
        const data = (await res.json().catch(() => null)) as
          | {
              holdId?: number | null
              abandoned?: boolean
              error?: string
              remainingCapacity?: number
              quantity?: number
            }
          | null
        if (!res.ok) {
          return { error: data?.error || 'Unable to reserve places' }
        }
        if (data?.abandoned) {
          return { abandoned: true, error: data.error }
        }
        const qty = Math.max(1, Number(data?.quantity) || opts.quantity)
        applyReserveSuccess(
          qty,
          typeof data?.remainingCapacity === 'number' ? data.remainingCapacity : undefined,
        )
        writeStoredGuestCheckout(timeslot.id, {
          name: opts.name,
          email: opts.email,
          quantity: qty,
          ownHoldQuantity: qty,
        })
        return {
          holdId: data?.holdId != null ? String(data.holdId) : undefined,
          remainingCapacity:
            typeof data?.remainingCapacity === 'number' ? data.remainingCapacity : undefined,
        }
      } finally {
        releaseInFlight()
        if (reserveInFlightRef.current === gate) {
          reserveInFlightRef.current = null
        }
      }
    },
    [applyReserveSuccess, timeslot.id],
  )

  // Restore mid-checkout guest after reload. pagehide releases the prior session's hold;
  // re-reserve with a fresh checkoutSessionId so the released tombstone cannot block us.
  // CheckoutForm also reserves on mount — both paths share postGuestReserve's mutex so we
  // never double-create active holds for the same guest.
  useEffect(() => {
    if (isAuthenticated || didRestoreRef.current) return
    didRestoreRef.current = true
    const saved = readStoredGuestCheckout(timeslot.id)
    if (!saved || saved.ownHoldQuantity <= 0) return

    const checkoutSessionId = newCheckoutSessionId()
    setGuestName(saved.name)
    setGuestEmail(saved.email)
    setQuantity(saved.quantity)
    const heldByAnyone = Math.max(0, remainingConfirmedOnly - remainingCapacity)
    if (heldByAnyone >= saved.ownHoldQuantity) {
      // Soft-sold-out / own hold still in SSR remaining — keep checkout open during restore.
      setOwnHoldQuantity(saved.ownHoldQuantity)
    }
    setSettledGuest({
      name: saved.name,
      email: saved.email,
      checkoutSessionId,
    })
    setIsReserving(true)

    const attempt = checkoutAttemptRef.current
    void (async () => {
      try {
        const result = await postGuestReserve({
          name: saved.name,
          email: saved.email,
          checkoutSessionId,
          quantity: saved.quantity,
        })
        if (attempt !== checkoutAttemptRef.current) return
        if (result.error || result.abandoned) {
          setSettledGuest(null)
          setOwnHoldQuantity(0)
          lastReservedQtyRef.current = 0
          writeStoredGuestCheckout(timeslot.id, null)
          setGuestFormError(
            result.error ||
              'Your previous reservation expired. Enter your details to try again.',
          )
        }
      } catch {
        if (attempt !== checkoutAttemptRef.current) return
        setSettledGuest(null)
        setOwnHoldQuantity(0)
        lastReservedQtyRef.current = 0
        writeStoredGuestCheckout(timeslot.id, null)
      } finally {
        if (attempt === checkoutAttemptRef.current) setIsReserving(false)
      }
    })()
  }, [isAuthenticated, timeslot.id, postGuestReserve, remainingCapacity, remainingConfirmedOnly])

  useEffect(() => {
    if (!settledGuest || ownHoldQuantity <= 0) {
      if (!settledGuest) writeStoredGuestCheckout(timeslot.id, null)
      return
    }
    writeStoredGuestCheckout(timeslot.id, {
      name: settledGuest.name,
      email: settledGuest.email,
      quantity,
      ownHoldQuantity,
    })
  }, [settledGuest, ownHoldQuantity, quantity, timeslot.id])

  // Release guest hold on refresh / tab close / navigate away / abandoning Continue.
  // Unload must use sync transport — see releaseGuestCheckoutHold + unit tests.
  useEffect(() => {
    if (!settledGuest) return

    const timeslotId = timeslot.id
    const guestEmail = settledGuest.email
    const checkoutSessionId = settledGuest.checkoutSessionId

    const releaseViaApi = (sync = false) => {
      releaseGuestCheckoutHold({
        timeslotId,
        guestEmail,
        checkoutSessionId,
        sync,
        skip: paymentRedirectInProgressRef.current,
      })
    }

    const handlePageExit = () => {
      checkoutAttemptRef.current += 1
      releaseViaApi(true)
    }

    window.addEventListener('pagehide', handlePageExit)
    window.addEventListener('beforeunload', handlePageExit)

    return () => {
      checkoutAttemptRef.current += 1
      window.removeEventListener('pagehide', handlePageExit)
      window.removeEventListener('beforeunload', handlePageExit)
      releaseViaApi(false)
    }
  }, [settledGuest, timeslot.id])

  const reserveGuestHold = useCallback(
    async (metadata: Record<string, string>) => {
      if (!settledGuest) return
      const attempt = checkoutAttemptRef.current
      const qty = Math.max(1, parseInt(metadata.quantity ?? String(quantity), 10) || quantity)
      // CheckoutForm remounts after Continue already reserved the same qty — skip the
      // network hop when nothing changed (mutex still serializes genuine overlaps).
      if (lastReservedQtyRef.current === qty && ownHoldQuantity === qty) {
        return undefined
      }
      const result = await postGuestReserve({
        name: settledGuest.name,
        email: settledGuest.email,
        checkoutSessionId: settledGuest.checkoutSessionId,
        quantity: qty,
      })
      if (result.error) {
        throw new Error(result.error)
      }
      if (result.abandoned || attempt !== checkoutAttemptRef.current) {
        releaseGuestCheckoutHold({
          timeslotId: timeslot.id,
          guestEmail: settledGuest.email,
          checkoutSessionId: settledGuest.checkoutSessionId,
          sync: false,
        })
        setOwnHoldQuantity(0)
        lastReservedQtyRef.current = 0
        writeStoredGuestCheckout(timeslot.id, null)
        return
      }
      return result.holdId != null ? { holdId: result.holdId } : undefined
    },
    [settledGuest, timeslot.id, quantity, ownHoldQuantity, postGuestReserve],
  )
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
    if (isPast || availability.soldOut || availability.temporarilyUnavailable || unitPrice <= 0) {
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
  }, [
    classPriceCents,
    isPast,
    availability.soldOut,
    availability.temporarilyUnavailable,
    timeslot.id,
    unitPrice,
  ])

  const canContinue =
    guestName.trim().length >= 2 && isCompleteGuestEmail(guestEmail.trim())

  const handleGuestFieldChange = (field: 'name' | 'email', value: string) => {
    if (field === 'name') setGuestName(value)
    else setGuestEmail(value)
    // Editing after Continue must re-confirm so progressive TLDs never create users.
    if (settledGuest) {
      setSettledGuest(null)
      setOwnHoldQuantity(0)
      lastReservedQtyRef.current = 0
      writeStoredGuestCheckout(timeslot.id, null)
    }
    if (guestFormError) setGuestFormError(null)
  }

  const handleContinueToPayment = async (e: React.FormEvent) => {
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
    const checkoutSessionId = newCheckoutSessionId()
    // Settle first so page-exit listeners are attached before/while the reserve runs.
    setSettledGuest({ name, email, checkoutSessionId })
    setIsReserving(true)

    try {
      const result = await postGuestReserve({
        name,
        email,
        checkoutSessionId,
        quantity,
      })
      if (result.error || result.abandoned) {
        setSettledGuest(null)
        setOwnHoldQuantity(0)
        lastReservedQtyRef.current = 0
        writeStoredGuestCheckout(timeslot.id, null)
        setGuestFormError(result.error || 'Unable to reserve places. Please try again.')
        return
      }
    } catch {
      setSettledGuest(null)
      setOwnHoldQuantity(0)
      lastReservedQtyRef.current = 0
      writeStoredGuestCheckout(timeslot.id, null)
      setGuestFormError('Unable to reserve places. Please try again.')
      return
    } finally {
      setIsReserving(false)
    }
  }

  const emphasizeRemaining = viewerRemaining > 0 && viewerRemaining <= 6

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

  if (availability.soldOut) {
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

  if (availability.temporarilyUnavailable) {
    return (
      <aside
        className="rounded-xl border border-border bg-card p-5 shadow-sm"
        data-testid="event-ticket-panel"
      >
        <h2 className="text-lg font-semibold text-foreground">Get tickets</h2>
        <p className="mt-2 text-sm font-medium text-amber-700 dark:text-amber-400">
          All places are currently being reserved. Please try again in a few minutes.
        </p>
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
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">Get tickets</h2>
        <p className="text-xl font-semibold tabular-nums text-foreground">
          €{unitPrice.toFixed(2)}{' '}
          <span className="text-sm font-normal text-muted-foreground">each</span>
        </p>
      </div>

      <p
        className={`mt-2 text-sm ${emphasizeRemaining ? 'font-medium text-amber-700 dark:text-amber-400' : 'text-muted-foreground'}`}
        data-testid="event-places-remaining"
      >
        {eventPlacesLabel(viewerRemaining)}
      </p>

      <div className="mt-4">
        <QuantitySelector
          timeslot={{ ...timeslot, remainingCapacity: maxQuantity } as Timeslot}
          quantity={quantity}
          onQuantityChange={setQuantity}
          maxQuantity={maxQuantity}
        />
      </div>

      {feeBreakdown ? (
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

            {!settledGuest || isReserving || ownHoldQuantity <= 0 ? (
              <Button
                type="submit"
                className="w-full"
                disabled={!canContinue || isReserving || Boolean(settledGuest)}
                data-testid="guest-checkout-continue"
              >
                {isReserving ? 'Reserving…' : 'Continue to payment'}
              </Button>
            ) : null}
          </form>

          {settledGuest && !isReserving && ownHoldQuantity > 0 ? (
            <CheckoutForm
              price={classPrice}
              priceComponent={
                <div className="my-2 text-lg font-medium">
                  Total: €{((feeBreakdown?.totalCents ?? classPriceCents) / 100).toFixed(2)}
                </div>
              }
              createPaymentIntentUrl="/api/events/guest-checkout"
              returnUrl={successUrl}
              onReserveCheckoutHold={reserveGuestHold}
              onPaymentRedirectStart={() => {
                paymentRedirectInProgressRef.current = true
                writeStoredGuestCheckout(timeslot.id, null)
                return () => {
                  paymentRedirectInProgressRef.current = false
                }
              }}
              metadata={{
                timeslotId: String(timeslot.id),
                quantity: String(quantity),
                guestName: settledGuest.name,
                guestEmail: settledGuest.email,
                checkoutSessionId: settledGuest.checkoutSessionId,
              }}
            />
          ) : settledGuest && isReserving ? (
            <p className="text-sm text-muted-foreground">Reserving your places…</p>
          ) : !settledGuest ? (
            <p className="text-sm text-muted-foreground">
              Enter your details, then continue when your email is complete.
            </p>
          ) : null}
        </div>
      )}
    </aside>
  )
}
