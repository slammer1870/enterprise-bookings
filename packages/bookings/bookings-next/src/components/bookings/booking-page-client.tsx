'use client'

import React, { useState } from 'react'
import { Timeslot } from '@repo/shared-types'
import { BookingSummary } from './booking-summary'
import { QuantitySelector } from './quantity-selector'
import { BookingForm } from './booking-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui/components/ui/card'

interface BookingPageClientProps {
  timeslot: Timeslot
  onSuccessRedirect?: string
}

export const BookingPageClient: React.FC<BookingPageClientProps> = ({
  timeslot,
  onSuccessRedirect,
}) => {
  const [quantity, setQuantity] = useState<number>(1)

  const maxQuantity = Math.max(1, timeslot.remainingCapacity || 1)

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
