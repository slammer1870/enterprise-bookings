'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Lesson } from '@repo/shared-types'
import { useTRPC } from '@repo/trpc/client'
import { useMutation } from '@tanstack/react-query'
import { BookingSummary } from './booking-summary'
import { QuantitySelector } from './quantity-selector'
import { BookingForm } from './booking-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui/components/ui/card'

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

  const maxQuantity = Math.max(1, lesson.remainingCapacity || 1)

  // Gate for showing "Payment Methods" block (Drop-in / Membership / Class pass tabs). Only the lesson data from the server
  // is used; there is no client-side Stripe Connect or tenant check. If the server returns a lesson without
  // classOption.paymentMethods populated (e.g. no tenant context so depth/overrideAccess omit it), this is false.
  const paymentMethods = lesson.classOption?.paymentMethods as
    | { allowedDropIn?: unknown; allowedPlans?: unknown[]; allowedClassPasses?: unknown[] }
    | undefined
  const hasPaymentMethods = Boolean(
    paymentMethods?.allowedDropIn ||
    (paymentMethods?.allowedPlans?.length ?? 0) > 0 ||
    (paymentMethods?.allowedClassPasses?.length ?? 0) > 0
  )

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
