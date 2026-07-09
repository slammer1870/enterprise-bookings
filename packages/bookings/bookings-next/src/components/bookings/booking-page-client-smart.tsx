'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Timeslot } from '@repo/shared-types'
import { useTRPC } from '@repo/trpc/client'
import { useMutation } from '@tanstack/react-query'
import { BookingSummary } from './booking-summary'
import { QuantitySelector } from './quantity-selector'
import { BookingForm } from './booking-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui/components/ui/card'
import type { CheckoutLegalConfig } from '@repo/payments-next'

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
    onReserveCheckoutHold?: (
      metadata: Record<string, string>,
    ) => Promise<Record<string, string> | void>
    /** Legal links shown below the drop-in payment form. */
    checkoutLegal?: CheckoutLegalConfig
  }>

  /**
   * Optional API used to cancel pending bookings when the user leaves the booking page.
   * If not provided, defaults to `/api/bookings/cancel-pending`.
   */
  cancelPendingApiUrl?: string

  /** When true, release checkout holds on leave instead of cancelling pending bookings. */
  useCheckoutHolds?: boolean

  /** API route for keepalive hold release on navigation (defaults to `/api/bookings/release-hold`). */
  releaseHoldApiUrl?: string

  /** Legal links shown below the drop-in payment form ("By placing your booking, you agree to our …"). */
  checkoutLegal?: CheckoutLegalConfig
}

export const BookingPageClientSmart: React.FC<BookingPageClientSmartProps> = ({
  timeslot,
  onSuccessRedirect,
  PaymentMethodsComponent,
  cancelPendingApiUrl = '/api/bookings/cancel-pending',
  useCheckoutHolds = false,
  releaseHoldApiUrl = '/api/bookings/release-hold',
  checkoutLegal,
}) => {
  const trpc = useTRPC()
  const [quantity, setQuantity] = useState<number>(1)
  // Debounced quantity — only this value flows into PaymentMethodsComponent.
  // Rapid + clicks update `quantity` for immediate UI feedback but network calls
  // (hold upsert + payment-intent bootstrap) wait until the user pauses for 350ms,
  // preventing concurrent hold upserts from exhausting the DB connection pool.
  const [debouncedQuantity, setDebouncedQuantity] = useState<number>(1)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuantity(quantity), 350)
    return () => clearTimeout(timer)
  }, [quantity])

  const paymentRedirectInProgressRef = useRef(false)
  /** Bumped on unmount so in-flight hold upserts after leave are rolled back. */
  const checkoutSessionRef = useRef(0)

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

  const { mutateAsync: releaseCheckoutHold } = useMutation(
    trpc.bookings.releaseCheckoutHold.mutationOptions()
  )

  const { mutateAsync: upsertCheckoutHold } = useMutation(
    trpc.bookings.upsertCheckoutHold.mutationOptions()
  )

  const { mutateAsync: extendCheckoutHoldMutation } = useMutation(
    trpc.bookings.extendCheckoutHold.mutationOptions()
  )

  const onReserveCheckoutHold = useCallback(
    async (metadata: Record<string, string>) => {
      const session = checkoutSessionRef.current
      // Use metadata.quantity (reflects debouncedQuantity) with debouncedQuantity
      // as fallback — never the raw `quantity` to avoid stale hold creation.
      const qty = Math.max(
        1,
        parseInt(metadata.quantity ?? String(debouncedQuantity), 10) || debouncedQuantity,
      )
      const result = await upsertCheckoutHold({
        timeslotId: timeslot.id,
        quantity: qty,
      })
      if (session !== checkoutSessionRef.current) {
        if (useCheckoutHolds && releaseHoldApiUrl) {
          const body = JSON.stringify({ timeslotId: timeslot.id })
          try {
            const xhr = new XMLHttpRequest()
            xhr.open('POST', releaseHoldApiUrl, false)
            xhr.setRequestHeader('Content-Type', 'application/json')
            xhr.withCredentials = true
            xhr.send(body)
          } catch {
            fetch(releaseHoldApiUrl, {
              method: 'POST',
              body,
              headers: { 'Content-Type': 'application/json' },
              keepalive: true,
              credentials: 'include',
            }).catch(() => {})
          }
        } else {
          await releaseCheckoutHold({ timeslotId: timeslot.id }).catch(() => {})
        }
        return
      }
      return { holdId: String(result.holdId) }
    },
    [
      upsertCheckoutHold,
      releaseCheckoutHold,
      timeslot.id,
      debouncedQuantity,
      useCheckoutHolds,
      releaseHoldApiUrl,
    ],
  )

  // When user leaves the booking page, cancel pending bookings or release checkout holds
  useEffect(() => {
    const timeslotId = timeslot.id

    const postAbandonViaApi = (sync: boolean) => {
      if (paymentRedirectInProgressRef.current) return
      const url = useCheckoutHolds ? releaseHoldApiUrl : cancelPendingApiUrl
      if (!url) return
      const body = JSON.stringify({ timeslotId })

      if (sync && typeof XMLHttpRequest !== 'undefined') {
        try {
          const xhr = new XMLHttpRequest()
          xhr.open('POST', url, false)
          xhr.setRequestHeader('Content-Type', 'application/json')
          xhr.withCredentials = true
          xhr.send(body)
          return
        } catch {
          // fall through to keepalive fetch
        }
      }

      fetch(url, {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        credentials: 'include',
      }).catch(() => {})
    }

    const handlePageHide = () => {
      checkoutSessionRef.current += 1
      postAbandonViaApi(true)
    }

    const handleBeforeUnload = () => {
      checkoutSessionRef.current += 1
      postAbandonViaApi(true)
    }

    window.addEventListener('pagehide', handlePageHide)
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      checkoutSessionRef.current += 1
      window.removeEventListener('pagehide', handlePageHide)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      if (paymentRedirectInProgressRef.current) return
      postAbandonViaApi(false)

      if (!useCheckoutHolds) {
        window.setTimeout(() => {
          if (paymentRedirectInProgressRef.current) return
          postAbandonViaApi(false)
        }, 1500)

        if (!cancelPendingApiUrl) {
          cancelPendingForTimeslot({ timeslotId }).catch(() => {})
        }
      }
    }
  }, [
    timeslot.id,
    cancelPendingForTimeslot,
    releaseCheckoutHold,
    cancelPendingApiUrl,
    releaseHoldApiUrl,
    useCheckoutHolds,
  ])

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
    setQuantity((prev) => {
      const clamped = Math.min(Math.max(1, prev), maxQuantity)
      // Sync the debounce target immediately on a hard capacity clamp so the
      // payment component never shows a stale quantity after the slot fills up.
      if (clamped !== prev) setDebouncedQuantity(clamped)
      return clamped
    })
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
            quantity={debouncedQuantity}
            onPaymentRedirectStart={() => {
              paymentRedirectInProgressRef.current = true
              if (useCheckoutHolds) {
                extendCheckoutHoldMutation({ timeslotId: timeslot.id }).catch(() => {})
              }
            }}
            onReserveCheckoutHold={useCheckoutHolds ? onReserveCheckoutHold : undefined}
            successUrl={onSuccessRedirect}
            checkoutLegal={checkoutLegal}
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
