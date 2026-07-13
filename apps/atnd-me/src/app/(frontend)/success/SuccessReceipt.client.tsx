'use client'

import type { ReceiptData } from '@/lib/receipt/get-receipt-data'
import { formatDateInTimeZone, formatInTimeZone } from '@repo/shared-utils/timezone'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card'

export function SuccessReceipt({ receipt }: { receipt: ReceiptData }) {
  const { timeslot, timeZone, bookingCount, amountPaidCents, currency, paymentMethod } = receipt

  const formatAmount = (cents: number) => {
    const amount = (cents / 100).toFixed(2)
    return currency.toUpperCase() === 'EUR' ? `€${amount}` : `${amount} ${currency.toUpperCase()}`
  }

  const formatDate = (startTime: string, endTime: string) => {
    const dateFormatted = formatDateInTimeZone(startTime, 'en-IE', timeZone, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    const start = formatInTimeZone(startTime, 'HH:mm', timeZone)
    const end = formatInTimeZone(endTime, 'HH:mm', timeZone)
    return `${dateFormatted} · ${start} – ${end}`
  }

  const paymentLabel =
    paymentMethod === 'stripe'
      ? 'card'
      : paymentMethod === 'class_pass'
        ? 'class pass'
        : paymentMethod === 'subscription'
          ? 'membership'
          : paymentMethod.replace(/_/g, ' ')

  return (
    <Card>
      <CardHeader>
        <CardTitle>Booking receipt</CardTitle>
        <CardDescription>Your booking confirmation details</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {timeslot && (
          <div>
            <p className="text-sm font-medium text-muted-foreground">Class</p>
            <p className="font-medium">{timeslot.className}</p>
            <p className="text-sm text-muted-foreground">
              {formatDate(timeslot.startTime, timeslot.endTime)}
            </p>
          </div>
        )}

        <div>
          <p className="text-sm font-medium text-muted-foreground">Number of bookings</p>
          <p className="font-medium">
            {bookingCount} {bookingCount === 1 ? 'slot' : 'slots'}
          </p>
        </div>

        {amountPaidCents != null && amountPaidCents > 0 && (
          <div>
            <p className="text-sm font-medium text-muted-foreground">Amount paid</p>
            <p className="font-medium">{formatAmount(amountPaidCents)}</p>
            <p className="text-xs text-muted-foreground capitalize">Paid via {paymentLabel}</p>
          </div>
        )}

        {paymentMethod === 'pay_at_door' && (
          <div>
            <p className="text-sm font-medium text-muted-foreground">Payment</p>
            <p className="text-sm">Pay at door</p>
          </div>
        )}

        {paymentMethod !== 'pay_at_door' && (amountPaidCents == null || amountPaidCents === 0) && (
          <div>
            <p className="text-sm font-medium text-muted-foreground">Payment</p>
            <p className="text-sm capitalize">Paid via {paymentLabel}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
