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
    adjustable?: boolean
    /** Legacy/alternate field name used by some older seeds/tests */
    allowMultipleBookingsPerTimeslot?: boolean
  } | null
  allowedPlans?:
    | Array<{
        sessionsInformation?: { allowMultipleBookingsPerTimeslot?: boolean } | null
      }>
    | null
  allowedClassPasses?: unknown[] | null
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

    const cancelViaApi = () => {
      if (paymentRedirectInProgressRef.current) return
      if (!cancelPendingApiUrl) return

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
      }, 500)
      window.setTimeout(() => {
        if (paymentRedirectInProgressRef.current) return
        cancelViaApi()
      }, 1500)

      // Also trigger TRPC mutation as a fallback when the component unmounts normally.
      cancelPendingForTimeslot({ timeslotId }).catch(() => {})
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
  const dropInAllowsMultiple =
    // Drop-in multi-quantity is controlled by the DropIn field `adjustable`.
    // Keep a fallback for legacy data/models that might have used a different name.
    paymentMethods?.allowedDropIn?.adjustable === true ||
    paymentMethods?.allowedDropIn?.allowMultipleBookingsPerTimeslot === true
  const planAllowsMultiple =
    paymentMethods?.allowedPlans?.some(
      (p) => p.sessionsInformation?.allowMultipleBookingsPerTimeslot === true
    ) ?? false
  const classPassAllowsMultiple =
    paymentMethods?.allowedClassPasses?.some((pass) => {
      if (!isObject(pass)) return false
      return pass.allowMultipleBookingsPerTimeslot === true
    }) ?? false
  // Match server-side gating: if payment methods exist, only allow multi-quantity when at least one method supports it.
  const allowsMultipleBookingsForViewer =
    !hasPaymentMethods || dropInAllowsMultiple || planAllowsMultiple || classPassAllowsMultiple
  const maxQuantity = allowsMultipleBookingsForViewer ? capacityMaxQuantity : 1

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
