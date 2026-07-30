/**
 * Event ticket availability for display / sold-out gating.
 *
 * Global `remainingCapacity` subtracts everyone's active checkout holds. Unpaid holds must
 * not hard-sold-out the page (only confirmed bookings do). A viewer who already holds spots
 * must still reach checkout when global remaining is 0 because of their own hold.
 */
export type EventPlacesAvailability = {
  /** Hard sell-out: confirmed bookings fill the event. */
  soldOut: boolean
  /** Soft block: holds fill free spots, but confirmed capacity remains — and viewer has no hold. */
  temporarilyUnavailable: boolean
  /** Remaining capacity shown in the places label for this viewer. */
  viewerRemaining: number
}

export function eventPlacesAvailability(opts: {
  /** places − confirmed − all active holds (from SSR / API) */
  remainingCapacity: number
  /** places − confirmed (ignores holds) */
  remainingConfirmedOnly: number
  /** Active hold quantity for the current viewer, if any */
  ownHoldQuantity?: number
}): EventPlacesAvailability {
  const ownHoldQuantity = Math.max(0, opts.ownHoldQuantity ?? 0)
  const remainingCapacity = Math.max(0, opts.remainingCapacity)
  const remainingConfirmedOnly = Math.max(0, opts.remainingConfirmedOnly)
  const soldOut = remainingConfirmedOnly <= 0
  // Own hold: keep checkout available even when global remaining is 0 (holds fill the room).
  const temporarilyUnavailable =
    !soldOut && remainingCapacity <= 0 && ownHoldQuantity <= 0
  // Prefer live global remaining; when it is 0 only because of our hold, show our reserved qty.
  const viewerRemaining =
    remainingCapacity > 0 ? remainingCapacity : ownHoldQuantity > 0 ? ownHoldQuantity : 0
  return { soldOut, temporarilyUnavailable, viewerRemaining }
}

export function eventPlacesLabel(remaining: number): string {
  if (remaining <= 0) return 'Sold out'
  if (remaining === 1) return '1 place left'
  return `${remaining} places left`
}

export function guestCheckoutHoldStorageKey(timeslotId: number | string): string {
  return `atnd-me:event-guest-checkout:${timeslotId}`
}

export type StoredGuestCheckout = {
  name: string
  email: string
  quantity: number
  ownHoldQuantity: number
}
