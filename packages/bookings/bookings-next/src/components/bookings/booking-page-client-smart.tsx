'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Lesson } from '@repo/shared-types'
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
    allowMultipleBookingsPerLesson?: boolean
  } | null
  allowedPlans?:
    | Array<{
        sessionsInformation?: { allowMultipleBookingsPerLesson?: boolean } | null
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
  lesson: Lesson
  onSuccessRedirect?: string
  /**
   * Component to render when payment methods are detected.
   * Receives lesson, and optionally quantity, pendingBookings, onPaymentSuccess for multi-booking/manage flow.
   */
  PaymentMethodsComponent?: React.ComponentType<{
    lesson: Lesson
    quantity?: number
    pendingBookings?: import('@repo/shared-types').Booking[]
    onPaymentSuccess?: () => void
    onPaymentRedirectStart?: () => void
    /** URL to redirect to after successful payment (Stripe Elements, Checkout Session). */
    successUrl?: string
  }>
}

export const BookingPageClientSmart: React.FC<BookingPageClientSmartProps> = ({
  lesson,
  onSuccessRedirect,
  PaymentMethodsComponent,
}) => {
  const trpc = useTRPC()
  const [quantity, setQuantity] = useState<number>(1)
  const paymentRedirectInProgressRef = useRef(false)

  if (!lesson?.id) {
    return (
      <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
        Invalid booking data: lesson is missing. Please go back and try again.
      </div>
    )
  }

  const { mutateAsync: cancelPendingForLesson } = useMutation(
    trpc.bookings.cancelPendingBookingsForLesson.mutationOptions()
  )

  // When user leaves the booking page, cancel any pending bookings for this lesson
  useEffect(() => {
    return () => {
      if (paymentRedirectInProgressRef.current) return
      cancelPendingForLesson({ lessonId: lesson.id }).catch(() => {})
    }
  }, [lesson.id, cancelPendingForLesson])

  // Gate for showing "Payment Methods" block (Drop-in / Membership / Class pass tabs). Only the lesson data from the server
  // is used; there is no client-side Stripe Connect or tenant check. If the server returns a lesson without
  // classOption.paymentMethods populated (e.g. no tenant context so depth/overrideAccess omit it), this is false.
  const paymentMethods = asPaymentMethodsLike(lesson.classOption?.paymentMethods)
  const hasPaymentMethods = Boolean(
    paymentMethods?.allowedDropIn ||
    (paymentMethods?.allowedPlans?.length ?? 0) > 0 ||
    (paymentMethods?.allowedClassPasses?.length ?? 0) > 0
  )

  const capacityMaxQuantity = Math.max(1, lesson.remainingCapacity || 1)
  const dropInAllowsMultiple =
    // Drop-in multi-quantity is controlled by the DropIn field `adjustable`.
    // Keep a fallback for legacy data/models that might have used a different name.
    paymentMethods?.allowedDropIn?.adjustable === true ||
    paymentMethods?.allowedDropIn?.allowMultipleBookingsPerLesson === true
  const planAllowsMultiple =
    paymentMethods?.allowedPlans?.some(
      (p) => p.sessionsInformation?.allowMultipleBookingsPerLesson === true
    ) ?? false
  // Match server-side gating: if payment methods exist, only allow multi-quantity when at least one method supports it.
  const allowsMultipleBookingsForViewer =
    !hasPaymentMethods || dropInAllowsMultiple || planAllowsMultiple
  const maxQuantity = allowsMultipleBookingsForViewer ? capacityMaxQuantity : 1

  useEffect(() => {
    setQuantity((q) => Math.min(Math.max(1, q), maxQuantity))
  }, [maxQuantity])

  // If payment methods exist, show payment gateway (filtered by quantity when pendingBookings/quantity > 1)
  if (hasPaymentMethods) {
    if (PaymentMethodsComponent) {
      return (
        <div className="space-y-6">
          <BookingSummary lesson={lesson} />
          <Card>
            <CardHeader>
              <CardTitle>Select Quantity</CardTitle>
              <CardDescription>
                Choose how many slots you would like to book for this lesson
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <QuantitySelector
                lesson={lesson}
                quantity={quantity}
                onQuantityChange={setQuantity}
                maxQuantity={maxQuantity}
              />
            </CardContent>
          </Card>

          <PaymentMethodsComponent
            lesson={lesson}
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
        <BookingSummary lesson={lesson} />
        <Card>
          <CardHeader>
            <CardTitle>Payment Required</CardTitle>
            <CardDescription>
              This lesson requires payment. Please provide a PaymentMethodsComponent
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
      <BookingSummary lesson={lesson} />

      <Card>
        <CardHeader>
          <CardTitle>Select Quantity</CardTitle>
          <CardDescription>
            Choose how many slots you would like to book for this lesson
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <QuantitySelector
            lesson={lesson}
            quantity={quantity}
            onQuantityChange={setQuantity}
            maxQuantity={maxQuantity}
          />

          {quantity >= 1 && quantity <= maxQuantity && (
            <BookingForm
              lesson={lesson}
              quantity={quantity}
              onSuccessRedirect={onSuccessRedirect}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
