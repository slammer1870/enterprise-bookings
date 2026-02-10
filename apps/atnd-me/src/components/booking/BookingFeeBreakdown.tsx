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
  bookingFeeCents: number
}

export function BookingFeeBreakdown({ classPriceCents, bookingFeeCents }: BookingFeeBreakdownProps) {
  const totalCents = classPriceCents + bookingFeeCents
  return (
    <Card data-testid="booking-fee-breakdown">
      <CardHeader>
        <CardTitle>Price breakdown</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Class price</span>
          <span data-testid="class-price">{formatCentsToCurrency(classPriceCents)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>Booking fee</span>
          <span data-testid="booking-fee">{formatCentsToCurrency(bookingFeeCents)}</span>
        </div>
        <div className="flex justify-between font-medium border-t pt-2 mt-2">
          <span>Total</span>
          <span data-testid="total">{formatCentsToCurrency(totalCents)}</span>
        </div>
      </CardContent>
    </Card>
  )
}
