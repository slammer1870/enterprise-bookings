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
  tierDiscountCents?: number
  promoDiscountCents?: number
  bookingFeeCents: number
  originalTotalCents?: number
  feeLabel?: string
}

export function BookingFeeBreakdown({
  classPriceCents,
  originalClassPriceCents,
  tierDiscountCents,
  promoDiscountCents,
  bookingFeeCents,
  originalTotalCents,
  feeLabel = 'Booking fee',
}: BookingFeeBreakdownProps) {
  const totalCents = classPriceCents + bookingFeeCents
  const hasBookingFee = bookingFeeCents > 0
  const hasTierDiscount = (tierDiscountCents ?? 0) > 0
  const hasPromoDiscount = (promoDiscountCents ?? 0) > 0
  const showOriginalClassPrice =
    typeof originalClassPriceCents === 'number' && originalClassPriceCents > classPriceCents
  const showOriginalTotal =
    typeof originalTotalCents === 'number' && originalTotalCents > totalCents
  return (
    <Card data-testid="booking-fee-breakdown">
      <CardHeader>
        {/* Avoid substring "Price" so Playwright E2E that does `getByText('Price')` targets the inner row label. */}
        <CardTitle>Payment breakdown</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Price</span>
          <span className="flex items-center gap-1" data-testid="class-price">
            {showOriginalClassPrice ? (
              <span className="line-through text-red-400" data-testid="class-price-original">
                {formatCentsToCurrency(originalClassPriceCents)}
              </span>
            ) : null}
            <span>{formatCentsToCurrency(classPriceCents)}</span>
          </span>
        </div>
        {hasTierDiscount && (
          <div className="flex justify-between text-sm">
            <span>Quantity discount</span>
            <span data-testid="tier-discount">-{formatCentsToCurrency(tierDiscountCents ?? 0)}</span>
          </div>
        )}
        {hasPromoDiscount && (
          <div className="flex justify-between text-sm">
            <span>Promo code</span>
            <span data-testid="promo-discount">-{formatCentsToCurrency(promoDiscountCents ?? 0)}</span>
          </div>
        )}
        {hasBookingFee && (
          <div className="flex justify-between text-sm">
            <span>{feeLabel}</span>
            <span data-testid="booking-fee">{formatCentsToCurrency(bookingFeeCents)}</span>
          </div>
        )}
        <div className="flex justify-between font-medium border-t pt-2 mt-2">
          <span>Total</span>
          <span className="flex items-center gap-1" data-testid="total">
            {showOriginalTotal ? (
              <span className="line-through text-red-400" data-testid="total-original">
                {formatCentsToCurrency(originalTotalCents)}
              </span>
            ) : null}
            <span>{formatCentsToCurrency(totalCents)}</span>
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
