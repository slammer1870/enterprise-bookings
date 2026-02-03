'use client'

import React, { useState } from 'react'
import { Lesson } from '@repo/shared-types'
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
  }>
}

export const BookingPageClientSmart: React.FC<BookingPageClientSmartProps> = ({
  lesson,
  onSuccessRedirect,
  PaymentMethodsComponent,
}) => {
  const [quantity, setQuantity] = useState<number>(1)

  const maxQuantity = Math.max(1, lesson.remainingCapacity || 1)

  // Check if lesson has payment methods configured (drop-in or plans)
  const hasPaymentMethods = Boolean(
    lesson.classOption.paymentMethods?.allowedDropIn ||
    (lesson.classOption.paymentMethods?.allowedPlans?.length ?? 0) > 0
  )

  // If payment methods exist, show payment gateway (filtered by quantity when pendingBookings/quantity > 1)
  if (hasPaymentMethods) {
    if (PaymentMethodsComponent) {
      return (
        <div className="space-y-6">
          <BookingSummary lesson={lesson} />
          <PaymentMethodsComponent lesson={lesson} />
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
