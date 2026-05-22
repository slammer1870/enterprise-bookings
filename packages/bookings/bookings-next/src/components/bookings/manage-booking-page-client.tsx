'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Timeslot, Booking } from '@repo/shared-types'
import { useTRPC } from '@repo/trpc/client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { BookingSummary } from './booking-summary'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card'
import { Button } from '@repo/ui/components/ui/button'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Minus, Plus, Trash2 } from 'lucide-react'
import { useConfirm } from '@repo/ui/components/ui/use-confirm'
import { format } from 'date-fns'

// ─── Types ────────────────────────────────────────────────────────────────────

type PaymentMethodsLike = {
  // Payload types can represent `allowedDropIn` as either a fully populated DropIn doc
  // or just a relation reference id. The manage page needs the per-user cap values,
  // so when we don't have the populated shape we should be conservative.
  allowedDropIn?:
    | {
        maxBookingsPerTimeslot?: number | null
        adjustable?: boolean
      }
    | number
    | null
  allowedPlans?: Array<{
    sessionsInformation?: {
      maxBookingsPerTimeslot?: number | null
      allowMultipleBookingsPerTimeslot?: boolean
    } | null
  }> | null
  allowedClassPasses?: Array<{
    maxBookingsPerTimeslot?: number | null
    allowMultipleBookingsPerTimeslot?: boolean
  }> | null
} | null

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function asPaymentMethodsLike(value: unknown): PaymentMethodsLike {
  if (typeof value !== 'object' || value === null) return null
  return value as PaymentMethodsLike
}

/** null/undefined = no cap (Infinity); number = enforced minimum of 1. */
function capFromRaw(raw: number | null | undefined): number {
  return raw == null ? Infinity : Math.max(1, raw)
}

/**
 * Returns the maximum number of bookings per timeslot the current viewer is
 * permitted across all configured payment methods. Returns Infinity when there
 * is no per-user cap.
 */
function computeViewerMax(paymentMethods: PaymentMethodsLike): number {
  if (!paymentMethods) return Infinity

  const caps: number[] = []

  if (paymentMethods.allowedDropIn) {
    const dropIn = paymentMethods.allowedDropIn
    // If `allowedDropIn` isn't populated (e.g. reference id only), we can't know the
    // per-user cap. Default conservatively to single-slot (1) so we never enable
    // quantity increases when the cap is unknown.
    if (typeof dropIn !== 'object' || dropIn === null) {
      caps.push(1)
    } else {
      const { maxBookingsPerTimeslot: raw, adjustable } = dropIn
      // Semantics:
      // - `maxBookingsPerTimeslot: null` means "no per-user cap" (unlimited).
      // - `maxBookingsPerTimeslot` being `undefined` means "not provided / unknown"
      //   (in which case we can only fall back to legacy `adjustable`).
      //
      // For the manage page, Payload serialization may omit `maxBookingsPerTimeslot`
      // when it is `null`. In that case, the client would incorrectly fall back
      // to the conservative `1` cap. Treat missing/undefined as "unlimited"
      // for populated drop-in objects.
      if (raw === null || typeof raw === 'undefined') caps.push(Infinity)
      else caps.push(capFromRaw(raw))
    }
  }

  for (const plan of paymentMethods.allowedPlans ?? []) {
    const si = plan?.sessionsInformation
    if (!si) continue
    const { maxBookingsPerTimeslot: raw, allowMultipleBookingsPerTimeslot: legacy } = si
    // Keep this consistent with PaymentMethods' membership-plan rules:
    // - if `maxBookingsPerTimeslot` is missing, only `allowMultipleBookingsPerTimeslot === true`
    //   should enable multi-booking; any other/undefined value means a single booking cap.
    caps.push(raw == null ? (legacy === true ? Infinity : 1) : capFromRaw(raw))
  }

  for (const pass of paymentMethods.allowedClassPasses ?? []) {
    const raw = pass.maxBookingsPerTimeslot
    const legacy = pass.allowMultipleBookingsPerTimeslot
    // Be conservative: when `maxBookingsPerTimeslot` isn't available and we
    // don't explicitly see `allowMultipleBookingsPerTimeslot === true`, treat
    // it as single-slot (1) rather than "unlimited".
    caps.push(capFromRaw(raw == null ? (legacy === true ? null : 1) : raw))
  }

  if (caps.length === 0) return Infinity
  return caps.some((c) => c === Infinity) ? Infinity : Math.max(1, ...caps)
}

function byStatus(bookings: Booking[], status: string): Booking[] {
  return bookings.filter((b) => String(b.status).toLowerCase() === status)
}

/** Merge two booking arrays, deduplicating by id (incoming wins). */
function mergeById(base: Booking[], incoming: Booking[]): Booking[] {
  const byId = new Map<number, Booking>()
  for (const b of base) byId.set(b.id, b)
  for (const b of incoming) byId.set(b.id, b)
  return Array.from(byId.values())
}

/**
 * Compute checkout "+" cap for pending additions.
 *
 * - `capacityPending`: timeslot remaining capacity (hard limit)
 * - `viewerMaxPerTimeslot`: per-user/payment-method max (Infinity = no cap)
 * - `alreadyHeld`: already confirmed/active bookings that count towards the cap
 */
function computeCheckoutMax(capacityPending: number, viewerMaxPerTimeslot: number, alreadyHeld: number) {
  const methodPending =
    viewerMaxPerTimeslot === Infinity ? Infinity : Math.max(0, viewerMaxPerTimeslot - alreadyHeld)

  return methodPending === Infinity ? capacityPending : Math.min(capacityPending, methodPending)
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ManageBookingPageClientProps {
  timeslot: Timeslot
  /**
   * Server-side user bookings for SSR hydration. Must be scoped to the current user.
   *
   * IMPORTANT: never use `timeslot.bookings.docs` — it can include other users' bookings
   * when the timeslot was fetched with elevated access for tenant routing.
   */
  initialBookings?: Booking[]
  /**
   * Component rendered when payment is required for additional bookings.
   * Receives timeslot, pendingBookings, and callbacks for lifecycle events.
   */
  PaymentMethodsComponent?: React.ComponentType<{
    timeslot: Timeslot
    pendingBookings?: Booking[]
    onPaymentSuccess?: () => void
    /** Called when user starts a payment redirect; suppresses pending-cancel on unmount. */
    onPaymentRedirectStart?: () => void
    successUrl?: string
  }>
  /**
   * POST endpoint used to cancel pending bookings on beforeunload (supports keepalive).
   * Falls back to tRPC mutation on unmount if not provided.
   */
  cancelPendingApiUrl?: string
  /** Redirect URL after successful payment. Defaults to /dashboard. */
  successUrl?: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export const ManageBookingPageClient: React.FC<ManageBookingPageClientProps> = ({
  timeslot,
  initialBookings,
  PaymentMethodsComponent,
  cancelPendingApiUrl,
  successUrl = '/dashboard',
}) => {
  const trpc = useTRPC()
  const router = useRouter()
  const queryClient = useQueryClient()

  const [ConfirmationDialog, confirm] = useConfirm(
    'Are you sure you want to cancel this booking?',
    'This action cannot be undone.'
  )

  // ── Server bookings query ──────────────────────────────────────────────────

  const userBookingsQueryKey = trpc.bookings.getUserBookingsForTimeslot.queryKey({
    timeslotId: timeslot.id,
  })

  const { data: bookings = [], isLoading } = useQuery({
    ...trpc.bookings.getUserBookingsForTimeslot.queryOptions({ timeslotId: timeslot.id }),
    // Hydrate immediately from SSR data; background refetch will settle it.
    initialData: initialBookings,
    staleTime: 30_000,
  })

  const activeBookings = useMemo(
    () => bookings.filter((b) => String(b.status).toLowerCase() !== 'cancelled'),
    [bookings]
  )
  const confirmedBookings = useMemo(() => byStatus(bookings, 'confirmed'), [bookings])

  // ── Payment method caps ────────────────────────────────────────────────────

  const paymentMethods = asPaymentMethodsLike(timeslot.eventType?.paymentMethods)
  const hasPaymentMethodsConfigured = Boolean(
    paymentMethods?.allowedDropIn ||
      (paymentMethods?.allowedPlans?.length ?? 0) > 0 ||
      (paymentMethods?.allowedClassPasses?.length ?? 0) > 0
  )

  const viewerMaxPerTimeslot = useMemo(() => computeViewerMax(paymentMethods), [paymentMethods])
  // Quantity increase is allowed when:
  //  - no payment methods configured (free lesson, unlimited additional slots), OR
  //  - payment methods exist and at least one allows maxBookingsPerTimeslot > 1
  const canIncreaseQuantity =
    !hasPaymentMethodsConfigured || (hasPaymentMethodsConfigured && viewerMaxPerTimeslot > 1)

  // ── Checkout state ────────────────────────────────────────────────────────
  //
  // `pendingBookings` is the local source of truth during checkout.
  // It is seeded from SSR initialBookings on first render, then updated
  // exclusively by mutations — never overwritten from the server query.
  //
  // `checkoutMaxRef` freezes `timeslot.remainingCapacity` at the moment
  // checkout begins so the ± selector cap stays stable even as the server
  // updates remainingCapacity in response to pending booking creation.

  const initialPending = useMemo(
    () => byStatus(initialBookings ?? [], 'pending'),
    []
  )

  const [isInCheckout, setIsInCheckout] = useState(
    () => initialPending.length > 0 && PaymentMethodsComponent != null
  )
  const [pendingBookings, setPendingBookings] = useState<Booking[]>(initialPending)
  const [pendingMutationError, setPendingMutationError] = useState<string | null>(null)

  // Frozen when checkout begins; never changes mid-session.
  // Seed it on first render (including SSR cases where the page loads already in checkout).
  const capacityPending = Math.max(0, timeslot.remainingCapacity)
  const alreadyHeld = activeBookings.length
  const checkoutMaxRef = useRef(computeCheckoutMax(capacityPending, viewerMaxPerTimeslot, alreadyHeld))

  // ── Quantity selector state (non-checkout view) ────────────────────────────

  const [desiredQuantity, setDesiredQuantity] = useState(() => activeBookings.length)

  // Keep the selector in sync when the server query updates (e.g. background refetch).
  useEffect(() => {
    if (isInCheckout) return
    setDesiredQuantity(activeBookings.length)
  }, [activeBookings.length, isInCheckout])

  // ── Per-booking UI state ───────────────────────────────────────────────────

  const [cancellingBookingId, setCancellingBookingId] = useState<number | null>(null)
  const [isAbandoningCheckout, setIsAbandoningCheckout] = useState(false)

  // ── Cancel-pending-on-leave ────────────────────────────────────────────────

  const paymentRedirectInProgressRef = useRef(false)

  const { mutateAsync: cancelPendingForTimeslot } = useMutation(
    trpc.bookings.cancelPendingBookingsForTimeslot.mutationOptions()
  )

  useEffect(() => {
    const timeslotId = timeslot.id

    const cancelViaApi = () => {
      if (paymentRedirectInProgressRef.current || !cancelPendingApiUrl) return
      fetch(cancelPendingApiUrl, {
        method: 'POST',
        body: JSON.stringify({ timeslotId }),
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        credentials: 'include',
      }).catch(() => {})
    }

    const handleBeforeUnload = () => cancelViaApi()
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      if (paymentRedirectInProgressRef.current) return
      cancelPendingForTimeslot({ timeslotId }).catch(() => {})
      // Fire a couple of extra cancels to catch pending bookings that might
      // finish creating just after unmount.
      window.setTimeout(() => {
        if (!paymentRedirectInProgressRef.current)
          cancelPendingForTimeslot({ timeslotId }).catch(() => {})
      }, 500)
      window.setTimeout(() => {
        if (!paymentRedirectInProgressRef.current)
          cancelPendingForTimeslot({ timeslotId }).catch(() => {})
      }, 1500)
    }
  }, [timeslot.id, cancelPendingForTimeslot, cancelPendingApiUrl])

  // ── Shared query invalidation ──────────────────────────────────────────────

  const invalidateBookingQueries = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: userBookingsQueryKey }),
      queryClient.invalidateQueries({ queryKey: trpc.timeslots.getByDate.queryKey() }),
      queryClient.invalidateQueries({
        queryKey: trpc.timeslots.getById.queryKey({ id: timeslot.id }),
      }),
      queryClient.invalidateQueries({
        queryKey: trpc.timeslots.getByIdForBooking.queryKey({ id: timeslot.id }),
      }),
    ])
    await queryClient.refetchQueries({ queryKey: userBookingsQueryKey })
  }, [queryClient, userBookingsQueryKey, timeslot.id, trpc])

  // ── Mutations ─────────────────────────────────────────────────────────────

  const { mutate: cancelBooking, mutateAsync: cancelBookingAsync, isPending: isCancelling } =
    useMutation(
      trpc.bookings.cancelBooking.mutationOptions({
        onSuccess: async () => {
          setCancellingBookingId(null)
          await invalidateBookingQueries()
        },
        onError: (error: { message?: string }) => {
          setCancellingBookingId(null)
          toast.error(error.message ?? 'Failed to cancel booking')
        },
      })
    )

  const { mutateAsync: createBookings, isPending: isCreating } = useMutation(
    trpc.bookings.createBookings.mutationOptions({
      onError: (error: { message?: string }) => {
        toast.error(error.message ?? 'Failed to create bookings')
      },
    })
  )

  const { mutateAsync: setBookingQuantity, isPending: isSettingQuantity } = useMutation(
    trpc.bookings.setMyBookingQuantityForTimeslot.mutationOptions({
      onSuccess: invalidateBookingQueries,
      onError: (error: { message?: string }) => {
        toast.error(error.message ?? 'Failed to update bookings')
      },
    })
  )

  const { mutateAsync: cancelNewestPending, isPending: isCancellingNewest } = useMutation(
    trpc.bookings.cancelNewestPendingBookingsForTimeslot.mutationOptions({
      onError: (error: { message?: string }) => {
        toast.error(error.message ?? 'Failed to update pending bookings')
      },
    })
  )

  // ── Checkout lifecycle helpers ────────────────────────────────────────────

  const enterCheckout = useCallback(
    (pending: Booking[], checkoutMaxOverride?: number) => {
      // Freeze checkout cap for "+" (pending bookings additions).
      // This must respect BOTH:
      //  1) timeslot remaining capacity (hard limit)
      //  2) per-user/payment-method maxBookingsPerTimeslot cap (viewerMaxPerTimeslot),
      //     adjusted by already-confirmed bookings.
      const capacityPending = Math.max(0, timeslot.remainingCapacity)
      if (typeof checkoutMaxOverride === 'number') {
        checkoutMaxRef.current = checkoutMaxOverride
      } else {
        const alreadyHeld = activeBookings.length
        checkoutMaxRef.current = computeCheckoutMax(capacityPending, viewerMaxPerTimeslot, alreadyHeld)
      }
      setPendingBookings(pending)
      setPendingMutationError(null)
      setIsInCheckout(true)
    },
    [timeslot.remainingCapacity, activeBookings.length, viewerMaxPerTimeslot]
  )

  const exitCheckout = useCallback(() => {
    setIsInCheckout(false)
    setPendingBookings([])
    setPendingMutationError(null)
  }, [])

  const handlePaymentSuccess = useCallback(() => {
    exitCheckout()
    void queryClient.invalidateQueries({ queryKey: userBookingsQueryKey })
    toast.success('Payment successful! Your bookings have been confirmed.')
  }, [exitCheckout, queryClient, userBookingsQueryKey])

  const handleCancelCheckout = useCallback(async () => {
    setIsAbandoningCheckout(true)
    try {
      await cancelPendingForTimeslot({ timeslotId: timeslot.id })
      exitCheckout()
      setDesiredQuantity(confirmedBookings.length)
      await queryClient.invalidateQueries({ queryKey: userBookingsQueryKey })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to cancel pending bookings'
      toast.error(msg)
    } finally {
      setIsAbandoningCheckout(false)
    }
  }, [
    cancelPendingForTimeslot,
    timeslot.id,
    exitCheckout,
    confirmedBookings.length,
    queryClient,
    userBookingsQueryKey,
  ])

  // ── Action handlers ───────────────────────────────────────────────────────

  const handleCancelSingleBooking = async (bookingId: number) => {
    if (!(await confirm())) return
    setCancellingBookingId(bookingId)
    cancelBooking({ id: bookingId })
  }

  const handleUpdateQuantity = async () => {
    const current = activeBookings.length
    const target = desiredQuantity
    if (target === current) {
      toast.info('No changes to update')
      return
    }

    // ── Increase: no payment methods → confirm immediately ───────────────
    if (target > current && !hasPaymentMethodsConfigured) {
      try {
        await createBookings({
          timeslotId: timeslot.id,
          quantity: target - current,
          status: 'confirmed',
        })
        await invalidateBookingQueries()
        toast.success('Booking updated')
      } catch {
        // Error toast handled by mutation onError
      }
      return
    }

    // ── Increase with payment required → enter checkout ──────────────────
    if (target > current && canIncreaseQuantity && PaymentMethodsComponent) {
      try {
        // Compute the checkout "+" cap BEFORE creating pending bookings.
        // This keeps the checkout freeze value aligned with the quantity
        // selector's enforced per-user cap, even if the client/server data
        // hydration timing changes during the async mutation.
        const capacityPending = Math.max(0, timeslot.remainingCapacity)
        const checkoutMaxOverride = computeCheckoutMax(
          capacityPending,
          viewerMaxPerTimeslot,
          activeBookings.length
        )

        const pending = await createBookings({
          timeslotId: timeslot.id,
          quantity: target - current,
          status: 'pending',
        })
        enterCheckout(pending, checkoutMaxOverride)
        toast.info('Please complete payment to confirm your additional bookings.')
      } catch {
        // Error toast handled by mutation onError
      }
      return
    }

    // ── Decrease ──────────────────────────────────────────────────────────
    if (target < current) {
      const pendingInServer = byStatus(bookings, 'pending')
      const toCancelTotal = current - target
      const toCancelPending = Math.min(pendingInServer.length, toCancelTotal)
      const toCancelConfirmed = toCancelTotal - toCancelPending

      if (toCancelConfirmed > 0 && !(await confirm())) return

      try {
        if (toCancelPending > 0) {
          const newestFirst = [...pendingInServer].sort(
            (a, b) =>
              new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
          )
          for (const b of newestFirst.slice(0, toCancelPending)) {
            if (b.id != null) await cancelBookingAsync({ id: b.id })
          }
          await queryClient.invalidateQueries({ queryKey: userBookingsQueryKey })
        }
        if (toCancelConfirmed > 0) {
          await setBookingQuantity({
            timeslotId: timeslot.id,
            desiredQuantity: confirmedBookings.length - toCancelConfirmed,
          })
        }
        toast.success(`Cancelled ${toCancelTotal} booking${toCancelTotal !== 1 ? 's' : ''}.`)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to update bookings'
        toast.error(msg)
      }
      return
    }

    // ── Increase without payment ──────────────────────────────────────────
    try {
      await setBookingQuantity({ timeslotId: timeslot.id, desiredQuantity: target })
      const delta = target - current
      toast.success(`Added ${delta} booking${delta !== 1 ? 's' : ''}.`)
    } catch {
      // Error toast handled by mutation onError
    }
  }

  /**
   * Autosave ± change to pending bookings during checkout.
   * `pendingBookings.length` is the single source of truth; no separate counter state.
   */
  const handlePendingQuantityChange = async (requestedQty: number) => {
    setPendingMutationError(null)
    const current = pendingBookings.length
    const target = Math.min(Math.max(requestedQty, 0), checkoutMaxRef.current)
    if (target === current) return

    // Dropping to 0 = abandon checkout
    if (target === 0) {
      await handleCancelCheckout()
      return
    }

    if (target < current) {
      const toCancel = current - target
      try {
        const { cancelledIds } = await cancelNewestPending({
          timeslotId: timeslot.id,
          count: toCancel,
        })
        const updated = pendingBookings.filter((b) => !cancelledIds.includes(b.id))
        setPendingBookings(updated)
        queryClient.setQueryData<Booking[]>(userBookingsQueryKey, (prev) =>
          (prev ?? []).filter((b) => !cancelledIds.includes(b.id))
        )
        toast.success(`Reduced to ${target} new booking${target !== 1 ? 's' : ''} to pay for.`)
      } catch (err: unknown) {
        setPendingMutationError(
          err instanceof Error ? err.message : 'Failed to update pending bookings'
        )
      }
      return
    }

    // target > current: add more pending
    try {
      const newPending = await createBookings({
        timeslotId: timeslot.id,
        quantity: target - current,
        status: 'pending',
      })
      const merged = mergeById(pendingBookings, newPending)
      setPendingBookings(merged)
      // Keep the server query cache consistent so React Query doesn't stomp local state.
      queryClient.setQueryData<Booking[]>(userBookingsQueryKey, (prev) =>
        mergeById(prev ?? [], newPending)
      )
      const added = target - current
      toast.success(`Added ${added} booking${added !== 1 ? 's' : ''}. Complete payment below.`)
    } catch (err: unknown) {
      setPendingMutationError(
        err instanceof Error ? err.message : 'Failed to add pending bookings'
      )
    }
  }

  // ── Loading state ─────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // ── Checkout view ─────────────────────────────────────────────────────────

  const isUpdatingPending = isCreating || isCancelling || isAbandoningCheckout || isCancellingNewest

  if (isInCheckout && PaymentMethodsComponent && pendingBookings.length > 0) {
    const pendingQty = pendingBookings.length
    const maxPending = checkoutMaxRef.current

    return (
      <div className="space-y-6">
        <ConfirmationDialog />
        <BookingSummary timeslot={timeslot} />

        <Card>
          <CardHeader>
            <CardTitle>New Bookings to Pay For</CardTitle>
            <CardDescription>
              You have {confirmedBookings.length} confirmed booking
              {confirmedBookings.length !== 1 ? 's' : ''}. Choose how many additional bookings to
              add and pay for now.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Number of new bookings</p>
                <p className="text-sm text-muted-foreground">
                  You can add up to {maxPending} new booking{maxPending !== 1 ? 's' : ''} for this
                  timeslot.
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  This will bring your total number of bookings up to{' '}
                  {confirmedBookings.length + pendingQty}.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  disabled={pendingQty <= 0 || isUpdatingPending}
                  onClick={() => void handlePendingQuantityChange(pendingQty - 1)}
                  aria-label="Decrease new bookings"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span
                  data-testid="pending-booking-quantity"
                  className="min-w-[2rem] text-center text-lg font-semibold"
                >
                  {pendingQty}
                </span>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  disabled={pendingQty >= maxPending || isUpdatingPending}
                  onClick={() => void handlePendingQuantityChange(pendingQty + 1)}
                  aria-label="Increase new bookings"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {isUpdatingPending ? 'Updating quantity...' : 'Changes save automatically.'}
            </p>
            {pendingMutationError && (
              <p
                data-testid="pending-quantity-mutation-error"
                className="text-sm text-destructive"
              >
                {pendingMutationError}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Complete Payment</CardTitle>
            <CardDescription>
              You have {pendingQty} pending booking{pendingQty !== 1 ? 's' : ''} for this timeslot.
              Please complete payment to confirm.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PaymentMethodsComponent
              timeslot={timeslot}
              pendingBookings={pendingBookings}
              onPaymentSuccess={handlePaymentSuccess}
              onPaymentRedirectStart={() => {
                paymentRedirectInProgressRef.current = true
              }}
              successUrl={successUrl}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <Button
              variant="outline"
              disabled={isAbandoningCheckout}
              onClick={() => void handleCancelCheckout()}
              className="w-full"
            >
              {isAbandoningCheckout ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cancelling...
                </>
              ) : (
                'Cancel'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── No-bookings fallback ───────────────────────────────────────────────────

  if (bookings.length === 0) {
    return (
      <div className="space-y-6">
        <BookingSummary timeslot={timeslot} />
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">You have no bookings for this timeslot.</p>
            <Button onClick={() => router.push(`/bookings/${timeslot.id}`)} className="mt-4">
              Book Now
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Quantity selector view ─────────────────────────────────────────────────

  const maxTotalQuantityBase = activeBookings.length + timeslot.remainingCapacity
  const maxTotalQuantity =
    viewerMaxPerTimeslot === Infinity
      ? maxTotalQuantityBase
      : Math.min(viewerMaxPerTimeslot, maxTotalQuantityBase)

  return (
    <div className="space-y-6">
      <ConfirmationDialog />
      <BookingSummary timeslot={timeslot} />

      <Card>
        <CardHeader>
          <CardTitle>Update Booking Quantity</CardTitle>
          <CardDescription>
            You currently have {activeBookings.length} booking
            {activeBookings.length !== 1 ? 's' : ''} for this timeslot. Adjust the total number of
            bookings you want to hold.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Number of bookings</p>
              <p className="text-sm text-muted-foreground">
                {hasPaymentMethodsConfigured && viewerMaxPerTimeslot === 1
                  ? 'Only 1 slot per timeslot per user.'
                  : `Up to ${maxTotalQuantity} total booking${maxTotalQuantity !== 1 ? 's' : ''} available for this timeslot.`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                size="icon"
                variant="outline"
                disabled={desiredQuantity <= 0 || isCreating || isCancelling}
                onClick={() => setDesiredQuantity((q) => Math.max(0, q - 1))}
                aria-label="Decrease quantity"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span
                data-testid="booking-quantity"
                className="min-w-[2rem] text-center text-lg font-semibold"
              >
                {desiredQuantity}
              </span>
              {!(hasPaymentMethodsConfigured && viewerMaxPerTimeslot === 1) && (
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  disabled={desiredQuantity >= maxTotalQuantity || isCreating || isCancelling}
                  onClick={() => setDesiredQuantity((q) => Math.min(maxTotalQuantity, q + 1))}
                  aria-label="Increase quantity"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <Button
            className="w-full"
            disabled={
              isCreating ||
              isCancelling ||
              isSettingQuantity ||
              desiredQuantity === activeBookings.length
            }
            onClick={() => void handleUpdateQuantity()}
          >
            {isCreating || isCancelling || isSettingQuantity ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating Bookings...
              </>
            ) : (
              'Update Bookings'
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your Bookings</CardTitle>
          <CardDescription>
            You have {bookings.length} booking{bookings.length !== 1 ? 's' : ''} for this timeslot.
            You can also cancel individual bookings below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {bookings.map((booking: Booking) => (
            <div
              key={booking.id}
              className="flex items-center justify-between p-4 border rounded-lg bg-muted/50"
            >
              <div className="flex-1">
                <p className="font-medium">Booking #{booking.id}</p>
                <p className="text-sm text-muted-foreground">
                  Status: <span className="capitalize">{booking.status}</span>
                </p>
                {booking.createdAt && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Created: {format(new Date(booking.createdAt), 'PPp')}
                  </p>
                )}
              </div>
              {booking.status === 'confirmed' && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => void handleCancelSingleBooking(booking.id)}
                  disabled={cancellingBookingId !== null}
                >
                  {cancellingBookingId === booking.id ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Cancelling...
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Cancel
                    </>
                  )}
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
