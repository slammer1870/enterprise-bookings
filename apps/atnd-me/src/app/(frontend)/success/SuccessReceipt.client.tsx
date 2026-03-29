'use client'

import type { ReceiptData } from '@/lib/receipt/get-receipt-data'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card'

export function SuccessReceipt({ receipt }: { receipt: ReceiptData }) {
  const { lesson, bookingCount, amountPaidCents, currency, paymentMethod } = receipt

  const formatAmount = (cents: number) => {
    const amount = (cents / 100).toFixed(2)
    return currency.toUpperCase() === 'EUR' ? `€${amount}` : `${amount} ${currency.toUpperCase()}`
  }

  const formatDate = (dateStr: string, startTime: string, endTime: string) => {
    try {
      const d = new Date(dateStr)
      const dateFormatted = d.toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
      return `${dateFormatted} · ${startTime} – ${endTime}`
    } catch {
      return `${dateStr} · ${startTime} – ${endTime}`
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Booking receipt</CardTitle>
        <CardDescription>Your booking confirmation details</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {lesson && (
          <div>
            <p className="text-sm font-medium text-muted-foreground">Class</p>
            <p className="font-medium">{lesson.className}</p>
            <p className="text-sm text-muted-foreground">
              {formatDate(lesson.date, lesson.startTime, lesson.endTime)}
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
            <p className="text-xs text-muted-foreground capitalize">
              Paid via {paymentMethod === 'stripe' ? 'card' : paymentMethod.replace('_', ' ')}
            </p>
          </div>
        )}

        {paymentMethod === 'pay_at_door' && (
          <div>
            <p className="text-sm font-medium text-muted-foreground">Payment</p>
            <p className="text-sm">Pay at door</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
