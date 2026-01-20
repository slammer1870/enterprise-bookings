'use client'

import React from 'react'
import { Lesson } from '@repo/shared-types'
import { Label } from '@repo/ui/components/ui/label'
import { Button } from '@repo/ui/components/ui/button'
import { Plus, Minus } from 'lucide-react'

interface QuantitySelectorProps {
  lesson: Lesson
  quantity: number
  onQuantityChange: (quantity: number) => void
}

export const QuantitySelector: React.FC<QuantitySelectorProps> = ({
  lesson,
  quantity,
  onQuantityChange,
}) => {
  const maxQuantity = Math.max(1, lesson.remainingCapacity || 1)
  const minQuantity = 1

  const handleDecrease = () => {
    if (quantity > minQuantity) {
      onQuantityChange(quantity - 1)
    }
  }

  const handleIncrease = () => {
    if (quantity < maxQuantity) {
      onQuantityChange(quantity + 1)
    }
  }

  return (
    <div className="space-y-2">
      <Label>Number of Slots</Label>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {maxQuantity === 1
            ? '1 slot available'
            : `${maxQuantity} slots available`}
        </span>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            size="icon"
            variant="outline"
            disabled={quantity <= minQuantity}
            onClick={handleDecrease}
            aria-label="Decrease quantity"
          >
            <Minus className="h-4 w-4" />
          </Button>
          <span className="min-w-[2rem] text-center text-lg font-semibold">
            {quantity}
          </span>
          <Button
            type="button"
            size="icon"
            variant="outline"
            disabled={quantity >= maxQuantity}
            onClick={handleIncrease}
            aria-label="Increase quantity"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {quantity > maxQuantity && (
        <p className="text-sm text-destructive">
          Maximum {maxQuantity} slot{maxQuantity !== 1 ? 's' : ''} available
        </p>
      )}
    </div>
  )
}
