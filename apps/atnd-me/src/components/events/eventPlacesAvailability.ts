/**
 * Event ticket availability for display / sold-out gating.
 *
 * Global `remainingCapacity` subtracts everyone's active checkout holds — including the
 * viewer's. Unpaid holds must not hard-sold-out the page (only confirmed bookings do).
 * The places label adds the viewer's own hold back so they are not charged for their seat.
 *
 * Callers that create a hold against a stale SSR remaining must decrement `remainingCapacity`
 * locally when the hold is applied (same pattern as manage-booking: remaining + ownHold).
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
  // Global remaining already subtracts this viewer's hold — add it back for their label.
  const viewerRemaining = Math.min(
    remainingConfirmedOnly,
    remainingCapacity + ownHoldQuantity,
  )
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
