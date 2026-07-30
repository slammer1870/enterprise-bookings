'use client'

import { useMemo, useState } from 'react'

import {
  eventPlacesAvailability,
  eventPlacesLabel,
  guestCheckoutHoldStorageKey,
} from '@/components/events/eventPlacesAvailability'

type EventPlacesMetaLabelProps = {
  timeslotId: number
  remainingCapacity: number
  remainingConfirmedOnly: number
  initialOwnHoldQuantity: number
  isAuthenticated: boolean
  className?: string
  emphasizeClassName?: string
  mutedClassName?: string
}

/**
 * Mobile hero capacity label. Guests have no auth session, so SSR cannot resolve their
 * hold — read sessionStorage so a reload still adds the viewer's own hold back.
 */
export function EventPlacesMetaLabel({
  timeslotId,
  remainingCapacity,
  remainingConfirmedOnly,
  initialOwnHoldQuantity,
  isAuthenticated,
  className,
  emphasizeClassName,
  mutedClassName,
}: EventPlacesMetaLabelProps) {
  const [guestOwnHold] = useState(() => {
    if (isAuthenticated || typeof sessionStorage === 'undefined') return 0
    try {
      const raw = sessionStorage.getItem(guestCheckoutHoldStorageKey(timeslotId))
      if (!raw) return 0
      const parsed = JSON.parse(raw) as { ownHoldQuantity?: unknown }
      const qty = Math.max(0, Number(parsed.ownHoldQuantity) || 0)
      if (qty <= 0) return 0
      const heldByAnyone = Math.max(0, remainingConfirmedOnly - remainingCapacity)
      return heldByAnyone >= qty ? qty : 0
    } catch {
      return 0
    }
  })

  const ownHoldQuantity = Math.max(0, initialOwnHoldQuantity, guestOwnHold)
  const availability = useMemo(
    () =>
      eventPlacesAvailability({
        remainingCapacity,
        remainingConfirmedOnly,
        ownHoldQuantity,
      }),
    [remainingCapacity, remainingConfirmedOnly, ownHoldQuantity],
  )

  const label = availability.soldOut
    ? 'Sold out'
    : availability.temporarilyUnavailable
      ? 'Currently being reserved'
      : eventPlacesLabel(availability.viewerRemaining)

  const emphasize =
    availability.viewerRemaining > 0 && availability.viewerRemaining <= 6

  return (
    <p
      className={`${className ?? ''} ${emphasize ? emphasizeClassName : mutedClassName}`}
      data-testid="event-meta-places"
    >
      {label}
    </p>
  )
}
