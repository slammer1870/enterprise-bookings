'use client'

/**
 * Step 2.7.2 – Checkout UX: transparent breakdown of Class price, Booking fee, Total.
 */
import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/ui/card'

function formatCentsToCurrency(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`
}

export type BookingFeeBreakdownProps = {
  classPriceCents: number
  originalClassPriceCents?: number
  promoDiscountCents?: number
  bookingFeeCents: number
}

export function BookingFeeBreakdown({
  classPriceCents,
  originalClassPriceCents,
  promoDiscountCents,
  bookingFeeCents,
}: BookingFeeBreakdownProps) {
  const totalCents = classPriceCents + bookingFeeCents
  const hasBookingFee = bookingFeeCents > 0
  const hasPromoDiscount = (promoDiscountCents ?? 0) > 0
  const displayClassPriceCents =
    hasPromoDiscount && typeof originalClassPriceCents === 'number'
      ? originalClassPriceCents
      : classPriceCents
  return (
    <Card data-testid="booking-fee-breakdown">
      <CardHeader>
        <CardTitle>Price breakdown</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Price</span>
          <span data-testid="class-price">{formatCentsToCurrency(displayClassPriceCents)}</span>
        </div>
        {hasPromoDiscount && (
          <div className="flex justify-between text-sm">
            <span>Promo code</span>
            <span data-testid="promo-discount">-{formatCentsToCurrency(promoDiscountCents ?? 0)}</span>
          </div>
        )}
        {hasBookingFee && (
          <div className="flex justify-between text-sm">
            <span>Booking fee</span>
            <span data-testid="booking-fee">{formatCentsToCurrency(bookingFeeCents)}</span>
          </div>
        )}
        <div className="flex justify-between font-medium border-t pt-2 mt-2">
          <span>Total</span>
          <span data-testid="total">{formatCentsToCurrency(totalCents)}</span>
        </div>
      </CardContent>
    </Card>
  )
}
