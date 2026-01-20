'use client'

import React, { useState } from 'react'
import { Lesson } from '@repo/shared-types'
import { BookingSummary } from './booking-summary'
import { QuantitySelector } from './quantity-selector'
import { BookingForm } from './booking-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui/components/ui/card'

interface BookingPageClientProps {
  lesson: Lesson
  onSuccessRedirect?: string
}

export const BookingPageClient: React.FC<BookingPageClientProps> = ({
  lesson,
  onSuccessRedirect,
}) => {
  const [quantity, setQuantity] = useState<number>(1)

  const maxQuantity = Math.max(1, lesson.remainingCapacity || 1)

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
