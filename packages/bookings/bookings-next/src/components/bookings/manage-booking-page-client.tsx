'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
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

type PaymentMethodsLike = {
  allowedDropIn?: {
    adjustable?: boolean
    allowMultipleBookingsPerTimeslot?: boolean
  } | null
  allowedPlans?:
    | Array<{
        sessionsInformation?: { allowMultipleBookingsPerTimeslot?: boolean } | null
      }>
    | null
  allowedClassPasses?:
    | Array<{
        allowMultipleBookingsPerTimeslot?: boolean
      }>
    | null
} | null

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function asPaymentMethodsLike(value: unknown): PaymentMethodsLike {
  if (!isObject(value)) return null
  return value as PaymentMethodsLike
}

/** Server snapshot of pending bookings — used for useState init so checkout mounts on first paint (no effect delay). */
function getInitialPendingFromBookings(bookings: Booking[] | undefined): Booking[] {
  if (!bookings?.length) return []
  return bookings.filter((b) => {
    const st = String(b.status).toLowerCase()
    return st !== 'cancelled' && st === 'pending'
  })
}

interface ManageBookingPageClientProps {
  timeslot: Timeslot
  /**
   * Optional initial bookings for this timeslot that belong to the current user.
   *
   * IMPORTANT: Do not derive this from `timeslot.bookings.docs` unless you are 100% sure
   * the timeslot was fetched with access controls enforced. In some server paths we fetch
   * timeslots with `overrideAccess: true` for multi-tenant compatibility, which can cause
   * joins like `timeslot.bookings` to include other users' bookings.
   */
  initialBookings?: Booking[]
  /**
   * Optional component to render when payment is required for additional bookings.
   * Should handle payment method selection (membership, drop-in, etc.)
   * 
   * @example
   * ```tsx
   * <ManageBookingPageClient 
   *   timeslot={timeslot}
   *   PaymentMethodsComponent={PaymentMethods}
   * />
   * ```
   */
  PaymentMethodsComponent?: React.ComponentType<{ 
    timeslot: Timeslot
    pendingBookings?: Booking[]
    onPaymentSuccess?: () => void
    /** Called when user starts payment redirect (e.g. to Stripe); used to avoid cancelling pending on page leave */
    onPaymentRedirectStart?: () => void
    /** URL to redirect to after successful payment */
    successUrl?: string
  }>
  /**
   * Optional URL for POST to cancel pending bookings (e.g. /api/bookings/cancel-pending).
   * When set, used on beforeunload so pending are cancelled when user closes the tab.
   */
  cancelPendingApiUrl?: string
  /** URL to redirect to after successful payment. Defaults to /dashboard for backwards compatibility. */
  successUrl?: string
}

/**
 * ManageBookingPageClient
 *
 * UX pattern inspired by Mindful Yard:
 * - Show booking summary
 * - Provide a single \"quantity\" control for total bookings
 * - Show a clear CTA to update quantity
 * - Still allow per-booking cancellation when needed
 * 
 * Payment handling:
 * - When increasing quantity, checks if payment is required
 * - If payment required: creates pending bookings and shows payment UI
 * - If no payment required: creates confirmed bookings directly
 */
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

  // Fetch user's bookings for this timeslot
  const { data: bookings, isLoading } = useQuery({
    ...trpc.bookings.getUserBookingsForTimeslot.queryOptions({ timeslotId: timeslot.id }),
    // Only ever hydrate with user-scoped bookings passed from the server.
    // Never trust `timeslot.bookings.docs` here because it can include other users'
    // bookings when timeslots are fetched with elevated access for tenant routing.
    initialData: initialBookings,
    // Keep it "fresh" long enough that the page renders immediately without a spinner,
    // but still allows eventual background refetches for correctness.
    staleTime: 30_000,
  })

  const activeBookings = useMemo(
    () => (bookings || []).filter((b) => String(b.status).toLowerCase() !== 'cancelled'),
    [bookings]
  )

  const confirmedBookings = useMemo(
    () => (bookings || []).filter((b) => String(b.status).toLowerCase() === 'confirmed'),
    [bookings]
  )

  const pendingFromServer = useMemo(
    () => activeBookings.filter((b) => String(b.status).toLowerCase() === 'pending'),
    [activeBookings]
  )

  const initialQuantity = activeBookings.length || 0

  // Desired total quantity of bookings for this timeslot.
  // IMPORTANT: `activeBookings` starts as `[]` until the query resolves.
  const [desiredQuantity, setDesiredQuantity] = useState<number>(initialQuantity)

  // Track pending bookings created for payment flow (or hydrated from server when user returns).
  // Initialize from `initialBookings` so SSR + React Query initialData show checkout immediately; relying only
  // on useEffect caused a first-paint flash of the quantity view and flaky E2E (Cancel not mounted yet).
  const [pendingBookings, setPendingBookings] = useState<Booking[]>(() =>
    getInitialPendingFromBookings(initialBookings)
  )
  const [isInPaymentFlow, setIsInPaymentFlow] = useState(
    () => getInitialPendingFromBookings(initialBookings).length > 0
  )
  /** In payment flow: desired number of new (pending) bookings to pay for. Controls the payment-flow quantity selector. */
  const [desiredPendingQuantity, setDesiredPendingQuantity] = useState<number>(() => {
    const initialPending = getInitialPendingFromBookings(initialBookings)
    return initialPending.length > 0 ? initialPending.length : 0
  })
  // When the user changes pending quantity (via +/-), prevent server-driven
  // pending sync from overwriting local state while the update is in flight.
  const [isAdjustingPendingQuantity, setIsAdjustingPendingQuantity] = useState(false)
  // When true, user has started a payment redirect (e.g. to Stripe) — don't cancel pending on unmount
  const paymentRedirectInProgressRef = useRef(false)
  const hasPendingBookingsRef = useRef(false)

  const { mutateAsync: cancelPendingForTimeslot } = useMutation(
    trpc.bookings.cancelPendingBookingsForTimeslot.mutationOptions()
  )

  // When user returns to the page after leaving checkout: show checkout again with server pending
  const hasHydratedCheckoutRef = useRef(
    getInitialPendingFromBookings(initialBookings).length > 0
  )
  useEffect(() => {
    if (pendingFromServer.length > 0 && !hasHydratedCheckoutRef.current) {
      hasHydratedCheckoutRef.current = true
      setPendingBookings(pendingFromServer)
      setIsInPaymentFlow(true)
      setDesiredQuantity(activeBookings.length)
    }
    if (pendingFromServer.length === 0) {
      hasHydratedCheckoutRef.current = false
    }
  }, [pendingFromServer, activeBookings.length])

  // Keep pendingBookings in sync with server when in payment flow (e.g. after user updates quantity).
  // Guard: only override when the server has data — avoids a race where isInPaymentFlow just became true
  // but the query is still stale (pendingFromServer = []), which would wipe freshly-created pending
  // booking IDs and trigger the "cancel on leave" cleanup effect prematurely.
  useEffect(() => {
    if (!isInPaymentFlow) return
    if (isAdjustingPendingQuantity) return
    if (pendingFromServer.length > 0) {
      setPendingBookings(pendingFromServer)
    }
  }, [isInPaymentFlow, isAdjustingPendingQuantity, pendingFromServer])

  useEffect(() => {
    hasPendingBookingsRef.current = pendingBookings.length > 0
  }, [pendingBookings.length])

  // Keep desired pending quantity in sync with actual pending count when in payment flow
  useEffect(() => {
    if (!isInPaymentFlow || pendingBookings.length === 0) return
    setDesiredPendingQuantity(pendingBookings.length)
  }, [isInPaymentFlow, pendingBookings.length])

  // Clamp desired pending to timeslot capacity so we never show/allow more than remainingCapacity new bookings
  useEffect(() => {
    if (!isInPaymentFlow) return
    const cap = Math.max(0, timeslot.remainingCapacity)
    setDesiredPendingQuantity((q) => (q > cap ? cap : q))
  }, [isInPaymentFlow, timeslot.remainingCapacity])

  // When the user leaves the booking/checkout page, cancel any pending bookings for this timeslot
  // so capacity is released.
  //
  // IMPORTANT: The E2E suite can navigate away quickly after creating pending bookings, before the
  // React state (`isInPaymentFlow` / `pendingBookings`) fully hydrates. So this cleanup must not be
  // gated on `isInPaymentFlow`; it should instead be gated only by whether a payment redirect
  // is currently in progress.
  useEffect(() => {
    const timeslotId = timeslot.id

    const handleBeforeUnload = () => {
      if (paymentRedirectInProgressRef.current) return
      // If cancelPendingApiUrl is provided, prefer the API call for beforeunload
      // (it supports keepalive and does not depend on React unmount timing).
      if (cancelPendingApiUrl) {
        fetch(cancelPendingApiUrl, {
          method: 'POST',
          body: JSON.stringify({ timeslotId }),
          headers: { 'Content-Type': 'application/json' },
          keepalive: true,
          credentials: 'include',
        }).catch(() => {})
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      if (paymentRedirectInProgressRef.current) return
      // Initial cancel
      cancelPendingForTimeslot({ timeslotId }).catch(() => {})

      // Race: pending reservations can finish slightly after unmount.
      // Attempt a second/third cancel after short delays to settle.
      window.setTimeout(() => {
        if (paymentRedirectInProgressRef.current) return
        cancelPendingForTimeslot({ timeslotId }).catch(() => {})
      }, 500)
      window.setTimeout(() => {
        if (paymentRedirectInProgressRef.current) return
        cancelPendingForTimeslot({ timeslotId }).catch(() => {})
      }, 1500)
    }
  }, [timeslot.id, cancelPendingForTimeslot, cancelPendingApiUrl])

  // Keep the UI in sync with the server-backed booking count.
  // This prevents the quantity control from getting stuck at 0 before the query resolves.
  useEffect(() => {
    if (isInPaymentFlow) return
    setDesiredQuantity(initialQuantity)
  }, [initialQuantity, isInPaymentFlow])
  
  // Track which booking is currently being cancelled (for per-booking loading state)
  const [cancellingBookingId, setCancellingBookingId] = useState<number | null>(null)
  // Track when we're abandoning checkout (cancelling all pending)
  const [isAbandoningCheckout, setIsAbandoningCheckout] = useState(false)

  // Check if timeslot has payment methods configured
  const paymentMethods = asPaymentMethodsLike(timeslot.eventType?.paymentMethods)
  const hasPaymentMethods = Boolean(
    paymentMethods?.allowedDropIn ||
      (paymentMethods?.allowedPlans?.length ?? 0) > 0 ||
      (paymentMethods?.allowedClassPasses?.length ?? 0) > 0
  )
  const dropInAllowsMultiple =
    paymentMethods?.allowedDropIn?.adjustable === true ||
    paymentMethods?.allowedDropIn?.allowMultipleBookingsPerTimeslot === true
  const planAllowsMultiple =
    paymentMethods?.allowedPlans?.some(
      (plan) => plan.sessionsInformation?.allowMultipleBookingsPerTimeslot === true
    ) ?? false
  const classPassAllowsMultiple =
    paymentMethods?.allowedClassPasses?.some(
      (classPass) => classPass.allowMultipleBookingsPerTimeslot === true
    ) ?? false
  const allowsMultipleBookingsForViewer =
    !hasPaymentMethods || dropInAllowsMultiple || planAllowsMultiple || classPassAllowsMultiple

  const { mutate: cancelBooking, mutateAsync: cancelBookingAsync, isPending: isCancelling } = useMutation(
    trpc.bookings.cancelBooking.mutationOptions({
      onSuccess: async () => {
        setCancellingBookingId(null) // Clear the cancelling state
        // Invalidate all booking-related queries to ensure UI updates
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: trpc.bookings.getUserBookingsForTimeslot.queryKey({
              timeslotId: timeslot.id,
            }),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.timeslots.getByDate.queryKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.timeslots.getById.queryKey({ id: timeslot.id }),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.timeslots.getByIdForBooking.queryKey({ id: timeslot.id }),
          }),
        ]);
        
        // Explicitly refetch active queries to ensure immediate UI update
        await Promise.all([
          queryClient.refetchQueries({
            queryKey: trpc.bookings.getUserBookingsForTimeslot.queryKey({
              timeslotId: timeslot.id,
            }),
          }),
          queryClient.refetchQueries({
            queryKey: trpc.timeslots.getByDate.queryKey(),
          }),
        ]);
      },
      onError: (error: { message?: string }) => {
        setCancellingBookingId(null) // Clear the cancelling state on error
        toast.error(error.message || 'Failed to cancel booking')
      },
    })
  )

  const { mutateAsync: createBookings, isPending: isCreating } = useMutation(
    trpc.bookings.createBookings.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.bookings.getUserBookingsForTimeslot.queryKey({
            timeslotId: timeslot.id,
          }),
        })
        queryClient.invalidateQueries({
          queryKey: trpc.timeslots.getByDate.queryKey(),
        })
      },
      onError: (error: { message?: string }) => {
        toast.error(error.message || 'Failed to update bookings')
      },
    })
  )

  const { mutateAsync: setBookingQuantity, isPending: isSettingQuantity } = useMutation(
    trpc.bookings.setMyBookingQuantityForTimeslot.mutationOptions({
      onSuccess: async () => {
        // Invalidate all booking-related queries to ensure UI updates
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: trpc.bookings.getUserBookingsForTimeslot.queryKey({
              timeslotId: timeslot.id,
            }),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.timeslots.getByDate.queryKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.timeslots.getById.queryKey({ id: timeslot.id }),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.timeslots.getByIdForBooking.queryKey({ id: timeslot.id }),
          }),
        ]);
        
        // Explicitly refetch active queries to ensure immediate UI update
        await Promise.all([
          queryClient.refetchQueries({
            queryKey: trpc.bookings.getUserBookingsForTimeslot.queryKey({
              timeslotId: timeslot.id,
            }),
          }),
          queryClient.refetchQueries({
            queryKey: trpc.timeslots.getByDate.queryKey(),
          }),
        ]);
      },
      onError: (error: { message?: string }) => {
        toast.error(error.message || 'Failed to update bookings')
      },
    })
  )

  const handleCancelSingleBooking = async (bookingId: number) => {
    const result = await confirm()
    if (result) {
      setCancellingBookingId(bookingId) // Set which booking is being cancelled
      cancelBooking({ id: bookingId })
    }
  }

  const handleUpdateQuantity = async () => {
    if (!bookings) return

    const current = activeBookings.length
    const target = desiredQuantity
    const confirmedCount = confirmedBookings.length
    const pendingCount = pendingFromServer.length

    if (target === current) {
      toast.info('No changes to update')
      return
    }

    // Decreasing quantity: only ask for confirmation when cancelling confirmed bookings.
    // Pending (unpaid) bookings are removed without the same confirmation.
    if (target < current) {
      const toCancelTotal = current - target
      const toCancelPending = Math.min(pendingCount, toCancelTotal)
      const toCancelConfirmed = toCancelTotal - toCancelPending

      if (toCancelConfirmed > 0) {
        const result = await confirm()
        if (!result) return
      }

      try {
        if (toCancelPending > 0) {
          const pendingToCancel = [...pendingFromServer]
            .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
            .slice(0, toCancelPending)
          for (const booking of pendingToCancel) {
            if (booking.id != null) await cancelBookingAsync({ id: booking.id })
          }
          await queryClient.invalidateQueries({
            queryKey: trpc.bookings.getUserBookingsForTimeslot.queryKey({ timeslotId: timeslot.id }),
          })
        }
        if (toCancelConfirmed > 0) {
          await setBookingQuantity({
            timeslotId: timeslot.id,
            desiredQuantity: confirmedCount - toCancelConfirmed,
          })
        }
        const delta = Math.abs(target - current)
        toast.success(
          `Cancelled ${delta} booking${delta !== 1 ? 's' : ''} for this timeslot.`
        )
      } catch (error: any) {
        toast.error(error?.message ?? 'Failed to update bookings')
      }
      return
    }

    // Check if payment is required for increasing bookings
    const isIncreasing = target > current
    const requiresPayment = isIncreasing && hasPaymentMethods && PaymentMethodsComponent

    if (requiresPayment) {
      // For payment flow, use the old createBookings with pending status
      const additional = target - current
      try {
        const newPendingBookings = await createBookings({
          timeslotId: timeslot.id,
          quantity: additional,
          status: 'pending',
        })
        setPendingBookings(newPendingBookings)
        setIsInPaymentFlow(true)
        toast.info('Please complete payment to confirm your additional bookings.')
      } catch (error: any) {
        toast.error(error.message || 'Failed to create pending bookings')
      }
      return
    }

    // Use the new setMyBookingQuantityForTimeslot mutation for all quantity changes
    // This handles both increase and decrease cases safely
    try {
      await setBookingQuantity({
        timeslotId: timeslot.id,
        desiredQuantity: target,
      })

      const delta = Math.abs(target - current)
      if (target > current) {
        toast.success(
          `Added ${delta} booking${delta !== 1 ? 's' : ''} for this timeslot.`
        )
      } else {
        toast.success(
          `Cancelled ${delta} booking${delta !== 1 ? 's' : ''} for this timeslot.`
        )
      }
    } catch (error: any) {
      // Error handling is done in mutation options
      console.error('Failed to update booking quantity:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const isUpdatingPendingQuantity = isCreating || isCancelling || isAbandoningCheckout

  /** In payment flow, +/- applies immediately so checkout stays in sync with the selected quantity. */
  const handlePendingQuantityChange = async (requestedQuantity: number) => {
    const current = pendingBookings.length
    const maxPendingQuantity = Math.max(0, timeslot.remainingCapacity)
    const target = Math.min(Math.max(requestedQuantity, 0), maxPendingQuantity)

    if (target === current) return
    setIsAdjustingPendingQuantity(true)
    try {
      setDesiredPendingQuantity(target)

      if (target === 0) {
        setIsAbandoningCheckout(true)
        try {
          await cancelPendingForTimeslot({ timeslotId: timeslot.id })
          setIsInPaymentFlow(false)
          setPendingBookings([])
          setDesiredPendingQuantity(0)
          setDesiredQuantity(confirmedBookings.length)
          await queryClient.invalidateQueries({
            queryKey: trpc.bookings.getUserBookingsForTimeslot.queryKey({ timeslotId: timeslot.id }),
          })
        } catch (err: any) {
          setDesiredPendingQuantity(current)
          toast.error(err?.message ?? 'Failed to cancel pending bookings')
        } finally {
          setIsAbandoningCheckout(false)
        }
        return
      }

      if (target < current) {
        const toCancel = current - target
        const pendingToCancel = [...pendingBookings]
          .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
          .slice(0, toCancel)
        try {
          for (const booking of pendingToCancel) {
            if (booking.id != null) await cancelBookingAsync({ id: booking.id })
          }
          setPendingBookings((prev) =>
            prev.filter((booking) => !pendingToCancel.some((pending) => pending.id === booking.id))
          )
          await queryClient.invalidateQueries({
            queryKey: trpc.bookings.getUserBookingsForTimeslot.queryKey({ timeslotId: timeslot.id }),
          })
          toast.success(`Reduced to ${target} new booking${target !== 1 ? 's' : ''} to pay for.`)
        } catch (err: any) {
          setDesiredPendingQuantity(current)
          toast.error(err?.message ?? 'Failed to update pending bookings')
        }
        return
      }

      // target > current: create more pending
      const toCreate = target - current
      try {
        const newPending = await createBookings({
          timeslotId: timeslot.id,
          quantity: toCreate,
          status: 'pending',
        })
        setPendingBookings((prev) => [...prev, ...newPending])
        toast.success(`Added ${toCreate} booking${toCreate !== 1 ? 's' : ''}. Complete payment below.`)
      } catch (err: any) {
        setDesiredPendingQuantity(current)
        toast.error(err?.message ?? 'Failed to add pending bookings')
      }
    } finally {
      setIsAdjustingPendingQuantity(false)
    }
  }

  // Handle payment success callback
  const handlePaymentSuccess = () => {
    setIsInPaymentFlow(false)
    setPendingBookings([])
    // Refresh bookings to show newly confirmed ones
    queryClient.invalidateQueries({
      queryKey: trpc.bookings.getUserBookingsForTimeslot.queryKey({
        timeslotId: timeslot.id,
      }),
    })
    toast.success('Payment successful! Your bookings have been confirmed.')
  }

  if (!bookings || bookings.length === 0) {
    return (
      <div className="space-y-6">
        <BookingSummary timeslot={timeslot} />
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">You have no bookings for this timeslot.</p>
            <Button
              onClick={() => router.push(`/bookings/${timeslot.id}`)}
              className="mt-4"
            >
              Book Now
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show payment UI if in payment flow (quantity selector = number of new/pending bookings to pay for)
  if (isInPaymentFlow && PaymentMethodsComponent && pendingBookings.length > 0) {
    // Cap by timeslot capacity: user's total (confirmed + pending) must not exceed confirmed + remainingCapacity
    const maxPendingQuantity = Math.max(0, timeslot.remainingCapacity)
    const minPendingQuantity = 0

    return (
      <div className="space-y-6">
        <ConfirmationDialog />
        <BookingSummary timeslot={timeslot} />

        {/* Quantity selector for new bookings (pending) to pay for */}
        <Card>
          <CardHeader>
            <CardTitle>New Bookings to Pay For</CardTitle>
            <CardDescription>
              You have {confirmedBookings.length} confirmed booking
              {confirmedBookings.length !== 1 ? 's' : ''}. Choose how many additional bookings to add and pay for now.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Number of new bookings</p>
                <p className="text-sm text-muted-foreground">
                  You can add up to {maxPendingQuantity} new booking
                  {maxPendingQuantity !== 1 ? 's' : ''} for this timeslot.
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  This will bring your total number of bookings up to{' '}
                  {Math.min(
                    confirmedBookings.length + desiredPendingQuantity,
                    confirmedBookings.length + maxPendingQuantity
                  )}
                  .
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  disabled={
                    desiredPendingQuantity <= minPendingQuantity || isUpdatingPendingQuantity
                  }
                  onClick={() => {
                    void handlePendingQuantityChange(desiredPendingQuantity - 1)
                  }}
                  aria-label="Decrease new bookings"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span
                  data-testid="pending-booking-quantity"
                  className="min-w-[2rem] text-center text-lg font-semibold"
                >
                  {desiredPendingQuantity}
                </span>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  disabled={
                    desiredPendingQuantity >= maxPendingQuantity || isUpdatingPendingQuantity
                  }
                  onClick={() => {
                    void handlePendingQuantityChange(desiredPendingQuantity + 1)
                  }}
                  aria-label="Increase new bookings"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {isUpdatingPendingQuantity ? 'Updating quantity...' : 'Changes save automatically.'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Complete Payment</CardTitle>
            <CardDescription>
              You have {pendingBookings.length} pending booking{pendingBookings.length !== 1 ? 's' : ''}{' '}
              for this timeslot. Please complete payment to confirm.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PaymentMethodsComponent 
              timeslot={timeslot}
              pendingBookings={pendingBookings}
              onPaymentSuccess={handlePaymentSuccess}
              onPaymentRedirectStart={() => { paymentRedirectInProgressRef.current = true }}
              successUrl={successUrl}
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <Button
              variant="outline"
              disabled={isAbandoningCheckout}
              onClick={async () => {
                setIsAbandoningCheckout(true)
                try {
                  await cancelPendingForTimeslot({ timeslotId: timeslot.id })
                  setIsInPaymentFlow(false)
                  setPendingBookings([])
                  setDesiredQuantity(confirmedBookings.length)
                  await queryClient.invalidateQueries({
                    queryKey: trpc.bookings.getUserBookingsForTimeslot.queryKey({
                      timeslotId: timeslot.id,
                    }),
                  })
                } catch (err: any) {
                  toast.error(err?.message ?? 'Failed to cancel pending bookings')
                } finally {
                  setIsAbandoningCheckout(false)
                }
              }}
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

  const maxTotalQuantity = allowsMultipleBookingsForViewer
    ? activeBookings.length + timeslot.remainingCapacity
    : Math.max(activeBookings.length, 1)
  const minQuantity = 0 // allow cancelling all via quantity control

  return (
    <div className="space-y-6">
      <ConfirmationDialog />
      <BookingSummary timeslot={timeslot} />

      {/* Quantity control card (Mindful Yard-style aggregate control) */}
      <Card>
        <CardHeader>
          <CardTitle>Update Booking Quantity</CardTitle>
          <CardDescription>
            You currently have {activeBookings.length} booking
            {activeBookings.length !== 1 ? 's' : ''} for this timeslot. Adjust the
            total number of bookings you want to hold.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Number of bookings</p>
              <p className="text-sm text-muted-foreground">
                {allowsMultipleBookingsForViewer
                  ? `Up to ${maxTotalQuantity} total booking${maxTotalQuantity !== 1 ? 's' : ''} available for this timeslot.`
                  : 'Only 1 slot per booking.'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                size="icon"
                variant="outline"
                disabled={desiredQuantity <= minQuantity || isCreating || isCancelling}
                onClick={() => setDesiredQuantity((q) => Math.max(minQuantity, q - 1))}
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
              <Button
                type="button"
                size="icon"
                variant="outline"
                disabled={
                  desiredQuantity >= maxTotalQuantity || isCreating || isCancelling
                }
                onClick={() =>
                  setDesiredQuantity((q) => Math.min(maxTotalQuantity, q + 1))
                }
                aria-label="Increase quantity"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Button
            className="w-full"
            disabled={isCreating || isCancelling || isSettingQuantity || desiredQuantity === initialQuantity}
            onClick={handleUpdateQuantity}
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

      {/* Detailed list for transparency and per-booking cancellation when needed */}
      <Card>
        <CardHeader>
          <CardTitle>Your Bookings</CardTitle>
          <CardDescription>
            You have {bookings.length} booking{bookings.length !== 1 ? 's' : ''} for
            this timeslot. You can also cancel individual bookings below.
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
              <div className="flex items-center gap-2">
                {booking.status === 'confirmed' && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleCancelSingleBooking(booking.id)}
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
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

