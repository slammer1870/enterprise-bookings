'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Timeslot } from '@repo/shared-types'
import { useTRPC } from '@repo/trpc/client'
import { useMutation } from '@tanstack/react-query'
import { BookingSummary } from './booking-summary'
import { QuantitySelector } from './quantity-selector'
import { BookingForm } from './booking-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui/components/ui/card'

type PaymentMethodsLike = {
  allowedDropIn?: {
    maxBookingsPerTimeslot?: number | null
  } | null
  allowedPlans?:
    | Array<{
        sessionsInformation?: { maxBookingsPerTimeslot?: number | null } | null
      }>
    | null
  allowedClassPasses?: Array<{ maxBookingsPerTimeslot?: number | null }> | null
} | null

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function asPaymentMethodsLike(value: unknown): PaymentMethodsLike {
  if (!isObject(value)) return null
  return value as PaymentMethodsLike
}

/**
 * Smart BookingPageClient that automatically detects payment methods
 * and conditionally renders payment selection or direct booking form.
 * 
 * This follows the same pattern as ChildrensBooking - if payment methods exist,
 * it expects a PaymentMethodsComponent to be provided; otherwise shows MVP booking form.
 * 
 * @example
 * ```tsx
 * // In your app's booking page config
 * import { BookingPageClientSmart } from '@repo/bookings-next'
 * import { PaymentMethods } from '@repo/payments-next'
 * 
 * const config: BookingPageConfig = {
 *   // ... other config
 *   BookingPageClient: (props) => (
 *     <BookingPageClientSmart 
 *       {...props} 
 *       PaymentMethodsComponent={PaymentMethods}
 *     />
 *   ),
 * }
 * ```
 */
interface BookingPageClientSmartProps {
  timeslot: Timeslot
  onSuccessRedirect?: string
  /**
   * Component to render when payment methods are detected.
   * Receives timeslot, and optionally quantity, pendingBookings, onPaymentSuccess for multi-booking/manage flow.
   */
  PaymentMethodsComponent?: React.ComponentType<{
    timeslot: Timeslot
    quantity?: number
    pendingBookings?: import('@repo/shared-types').Booking[]
    onPaymentSuccess?: () => void
    onPaymentRedirectStart?: () => void
    /** URL to redirect to after successful payment (Stripe Elements, Checkout Session). */
    successUrl?: string
  }>

  /**
   * Optional API used to cancel pending bookings when the user leaves the booking page.
   * If not provided, defaults to `/api/bookings/cancel-pending`.
   */
  cancelPendingApiUrl?: string
}

export const BookingPageClientSmart: React.FC<BookingPageClientSmartProps> = ({
  timeslot,
  onSuccessRedirect,
  PaymentMethodsComponent,
  cancelPendingApiUrl = '/api/bookings/cancel-pending',
}) => {
  const trpc = useTRPC()
  const [quantity, setQuantity] = useState<number>(1)
  const paymentRedirectInProgressRef = useRef(false)
  const hasCancelledOnLeaveRef = useRef(false)

  if (!timeslot?.id) {
    return (
      <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
        Invalid booking data: timeslot is missing. Please go back and try again.
      </div>
    )
  }

  const { mutateAsync: cancelPendingForTimeslot } = useMutation(
    trpc.bookings.cancelPendingBookingsForTimeslot.mutationOptions()
  )

  // When user leaves the booking page, cancel any pending bookings for this timeslot
  useEffect(() => {
    const timeslotId = timeslot.id
    hasCancelledOnLeaveRef.current = false

    const cancelViaApi = () => {
      if (paymentRedirectInProgressRef.current) return
      if (!cancelPendingApiUrl) return
      if (hasCancelledOnLeaveRef.current) return
      hasCancelledOnLeaveRef.current = true

      // Use keepalive so the request has a chance to reach the server during navigation/unmount.
      fetch(cancelPendingApiUrl, {
        method: 'POST',
        body: JSON.stringify({ timeslotId }),
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        credentials: 'include',
      }).catch(() => {})
    }

    const handleBeforeUnload = () => {
      cancelViaApi()
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      if (paymentRedirectInProgressRef.current) return
      // Prefer the API approach first (it doesn't depend on TRPC client state).
      cancelViaApi()

      // Race: the UI can still be in the middle of reserving pending bookings (via
      // `create-payment-intent`) when we unmount. Reserving might complete after the
      // initial cancel request, leaving a small number of pending bookings.
      // Fire a couple of additional cancels after a short delay to settle the state.
      window.setTimeout(() => {
        if (paymentRedirectInProgressRef.current) return
        cancelViaApi()
      }, 1500)

      // Also trigger TRPC mutation as a fallback when we don't have an API url
      // for keepalive cancellation.
      if (!cancelPendingApiUrl) {
        cancelPendingForTimeslot({ timeslotId }).catch(() => {})
      }
    }
  }, [timeslot.id, cancelPendingForTimeslot, cancelPendingApiUrl])

  // Gate for showing "Payment Methods" block (Drop-in / Membership / Class pass tabs). Only the timeslot data from the server
  // is used; there is no client-side Stripe Connect or tenant check. If the server returns a timeslot without
  // eventType.paymentMethods populated (e.g. no tenant context so depth/overrideAccess omit it), this is false.
  const paymentMethods = asPaymentMethodsLike(timeslot.eventType?.paymentMethods)
  const hasPaymentMethods = Boolean(
    paymentMethods?.allowedDropIn ||
    (paymentMethods?.allowedPlans?.length ?? 0) > 0 ||
    (paymentMethods?.allowedClassPasses?.length ?? 0) > 0
  )

  const capacityMaxQuantity = Math.max(1, timeslot.remainingCapacity || 1)

  const maxFromMaybeCap = (raw: unknown): number => {
    if (raw == null) return Infinity
    const n = Number(raw)
    return Number.isFinite(n) ? Math.max(1, n) : Infinity
  }

  // When multiple payment methods exist, allow quantity up to the maximum
  // per-viewer cap among them. PaymentMethodsComponent will filter tabs/options
  // when quantity exceeds a specific method's cap.
  const viewerMaxFromPaymentOptions = (() => {
    if (!hasPaymentMethods) return Infinity

    const dropInMax = paymentMethods?.allowedDropIn
      ? (() => {
          const dropInAny = paymentMethods.allowedDropIn as any
          const rawMax = dropInAny.maxBookingsPerTimeslot as number | null | undefined
          if (rawMax == null) {
            return dropInAny.adjustable === false ? 1 : Infinity
          }
          return maxFromMaybeCap(rawMax)
        })()
      : 1
    const planCapsWithLegacy =
      paymentMethods?.allowedPlans?.map((p) => {
        const siAny = p.sessionsInformation as any
        const rawMax = siAny?.maxBookingsPerTimeslot as number | null | undefined
        if (rawMax == null) {
          return maxFromMaybeCap(siAny?.allowMultipleBookingsPerTimeslot === false ? 1 : null)
        }
        return maxFromMaybeCap(rawMax)
      }) ?? []
    const classPassCaps =
      paymentMethods?.allowedClassPasses?.map((p) => {
        const passAny = p as any
        const rawMax = passAny?.maxBookingsPerTimeslot as number | null | undefined
        if (rawMax == null) {
          return maxFromMaybeCap(passAny?.allowMultipleBookingsPerTimeslot === false ? 1 : null)
        }
        return maxFromMaybeCap(rawMax)
      }) ?? []

    const caps = [dropInMax, ...planCapsWithLegacy, ...classPassCaps]
    return caps.some((c) => c === Infinity) ? Infinity : Math.max(1, ...caps)
  })()

  const maxQuantity =
    viewerMaxFromPaymentOptions === Infinity
      ? capacityMaxQuantity
      : Math.min(capacityMaxQuantity, viewerMaxFromPaymentOptions)

  useEffect(() => {
    setQuantity((q) => Math.min(Math.max(1, q), maxQuantity))
  }, [maxQuantity])

  // If payment methods exist, show payment gateway (filtered by quantity when pendingBookings/quantity > 1)
  if (hasPaymentMethods) {
    if (PaymentMethodsComponent) {
      return (
        <div className="space-y-6">
          <BookingSummary timeslot={timeslot} />
          <Card>
            <CardHeader>
              <CardTitle>Select Quantity</CardTitle>
              <CardDescription>
                Choose how many slots you would like to book for this timeslot
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <QuantitySelector
                timeslot={timeslot}
                quantity={quantity}
                onQuantityChange={setQuantity}
                maxQuantity={maxQuantity}
              />
            </CardContent>
          </Card>

          <PaymentMethodsComponent
            timeslot={timeslot}
            quantity={quantity}
            onPaymentRedirectStart={() => { paymentRedirectInProgressRef.current = true }}
            successUrl={onSuccessRedirect}
          />
        </div>
      )
    }

    // If payment methods exist but no component provided, show helpful message
    return (
      <div className="space-y-6">
        <BookingSummary timeslot={timeslot} />
        <Card>
          <CardHeader>
            <CardTitle>Payment Required</CardTitle>
            <CardDescription>
              This timeslot requires payment. Please provide a PaymentMethodsComponent
              prop to handle payment method selection.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  // No payment methods - show MVP booking form (quantity selector + booking form)
  return (
    <div className="space-y-6">
      <BookingSummary timeslot={timeslot} />

      <Card>
        <CardHeader>
          <CardTitle>Select Quantity</CardTitle>
          <CardDescription>
            Choose how many slots you would like to book for this timeslot
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <QuantitySelector
            timeslot={timeslot}
            quantity={quantity}
            onQuantityChange={setQuantity}
            maxQuantity={maxQuantity}
          />

          {quantity >= 1 && quantity <= maxQuantity && (
            <BookingForm
              timeslot={timeslot}
              quantity={quantity}
              onSuccessRedirect={onSuccessRedirect}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
