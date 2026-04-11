'use client'

import React from 'react'
import { Timeslot } from '@repo/shared-types'
import { Label } from '@repo/ui/components/ui/label'
import { Button } from '@repo/ui/components/ui/button'
import { Plus, Minus } from 'lucide-react'

interface QuantitySelectorProps {
  timeslot: Timeslot
  quantity: number
  onQuantityChange: (quantity: number) => void
  /** Optional override to cap quantity due to payment-method rules. */
  maxQuantity?: number
}

export const QuantitySelector: React.FC<QuantitySelectorProps> = ({
  timeslot,
  quantity,
  onQuantityChange,
  maxQuantity: maxQuantityOverride,
}) => {
  const capacityMaxQuantity = Math.max(1, timeslot.remainingCapacity || 1)
  const maxQuantity =
    typeof maxQuantityOverride === 'number'
      ? Math.max(1, maxQuantityOverride)
      : capacityMaxQuantity
  const minQuantity = 1
  const canAdjustQuantity = maxQuantity > minQuantity
  const isCappedByRules = maxQuantity < capacityMaxQuantity

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
          {isCappedByRules
            ? 'Only 1 slot per booking'
            : capacityMaxQuantity === 1
              ? '1 slot available'
              : `${capacityMaxQuantity} slots available`}
        </span>
        {canAdjustQuantity ? (
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
        ) : (
          <span className="min-w-[2rem] text-center text-lg font-semibold">
            {quantity}
          </span>
        )}
      </div>
      {quantity > maxQuantity && (
        <p className="text-sm text-destructive">
          Maximum {maxQuantity} slot{maxQuantity !== 1 ? 's' : ''} available
        </p>
      )}
    </div>
  )
}
