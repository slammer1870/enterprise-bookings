'use client'

/**
 * Step 2.7.2 – Booking page client that shows Class price / Booking fee / Total when payments enabled.
 */
import React, { useState } from 'react'
import { Lesson } from '@repo/shared-types'
import { BookingSummary } from '@repo/bookings-next'
import { QuantitySelector } from '@repo/bookings-next'
import { BookingForm } from '@repo/bookings-next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui/components/ui/card'
import { BookingFeeBreakdown } from '@/components/booking/BookingFeeBreakdown'

/** Demo values for Step 2.7.2 – replace with tRPC/fetch when class option has priceCents. */
const DEMO_CLASS_PRICE_CENTS = 1000
const DEMO_BOOKING_FEE_CENTS = 30

type BookingPageClientWithBreakdownProps = {
  lesson: Lesson
  onSuccessRedirect?: string
}

export function BookingPageClientWithBreakdown({
  lesson,
  onSuccessRedirect,
}: BookingPageClientWithBreakdownProps) {
  const [quantity, setQuantity] = useState(1)
  const maxQuantity = Math.max(1, lesson.remainingCapacity || 1)
  const co = lesson.classOption as {
    paymentMethods?: {
      allowedDropIn?: unknown
      allowedPlans?: unknown[] | null
      allowedClassPasses?: unknown[] | null
    }
  } | number | undefined
  const hasAnyPaymentMethod =
    co != null &&
    typeof co === 'object' &&
    co.paymentMethods != null &&
    (co.paymentMethods.allowedDropIn != null ||
      (Array.isArray(co.paymentMethods.allowedPlans) && co.paymentMethods.allowedPlans.length > 0) ||
      (Array.isArray(co.paymentMethods.allowedClassPasses) && co.paymentMethods.allowedClassPasses.length > 0))

  // Step 2.7.2: Show Class price / Booking fee / Total when payment methods are attached.
  const showBreakdown = hasAnyPaymentMethod || (co != null && typeof co === 'object')

  return (
    <div className="space-y-6">
      <BookingSummary lesson={lesson} />

      {showBreakdown && (
        <BookingFeeBreakdown
          classPriceCents={DEMO_CLASS_PRICE_CENTS}
          bookingFeeCents={DEMO_BOOKING_FEE_CENTS}
        />
      )}

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
