/**
 * Helpers for create-payment-intent API: validate booking IDs, reserve pending capacity.
 */

import { ATND_ME_BOOKINGS_COLLECTION_SLUGS } from '@/constants/bookings-collection-slugs'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PayloadLike = any

/** Validate and resolve explicit booking IDs from metadata (modify-booking flow). */
export async function validateBookingIdsFromMetadata(
  payload: PayloadLike,
  metadata: { bookingIds?: string },
  opts: { timeslotId: number; userId: number; user?: unknown }
): Promise<string[]> {
  const raw = metadata?.bookingIds
  if (!raw || typeof raw !== 'string') return []

  const parsed = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (parsed.length === 0) return []

  const ids = parsed.map((id) => parseInt(id, 10)).filter((n) => !Number.isNaN(n))
  if (ids.length === 0) return []

  const docs = await payload.find({
    collection: 'bookings',
    where: {
      and: [
        { id: { in: ids } },
        { timeslot: { equals: opts.timeslotId } },
        { user: { equals: opts.userId } },
        { status: { equals: 'pending' } },
      ],
    },
    depth: 0,
    limit: parsed.length,
    // These booking IDs come from the client; enforce access controls.
    overrideAccess: false,
    user: opts.user,
  })

  return (docs.docs as { id: number }[]).map((b) => String(b.id))
}

/** Format capacity error message. */
export function formatCapacityError(remaining: number, requested: number): string {
  if (remaining === 0) return 'This timeslot is fully booked.'
  return `Only ${remaining} spot${remaining !== 1 ? 's' : ''} available. You requested ${requested}.`
}

/**
 * Same rules as bookings-plugin remainingCapacity virtual field: places minus
 * confirmed + recent pending bookings. Use when findByID did not populate the virtual.
 */
export async function computeRemainingCapacityForTimeslot(
  payload: PayloadLike,
  timeslotId: number,
  timeslotDoc?: { eventType?: number | { id: number } | null } | null
): Promise<number> {
  const ts =
    timeslotDoc ??
    ((await payload.findByID({
      collection: ATND_ME_BOOKINGS_COLLECTION_SLUGS.timeslots,
      id: timeslotId,
      depth: 1,
      overrideAccess: true,
    })) as { eventType?: number | { id: number } | null } | null)

  if (!ts?.eventType) return 0

  const eventTypeId =
    typeof ts.eventType === 'object' && ts.eventType !== null ? ts.eventType.id : ts.eventType

  if (!eventTypeId) return 0

  const eventType = (await payload.findByID({
    collection: ATND_ME_BOOKINGS_COLLECTION_SLUGS.eventTypes,
    id: eventTypeId,
    depth: 0,
    overrideAccess: true,
    context: { triggerAfterChange: false },
  })) as { places?: number } | null

  const places = typeof eventType?.places === 'number' ? eventType.places : 0

  const pendingCutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString()
  const bookings = await payload.find({
    collection: ATND_ME_BOOKINGS_COLLECTION_SLUGS.bookings,
    depth: 0,
    limit: 0,
    overrideAccess: true,
    context: { triggerAfterChange: false },
    where: {
      and: [
        { timeslot: { equals: timeslotId } },
        {
          or: [
            { status: { equals: 'confirmed' } },
            {
              and: [
                { status: { equals: 'pending' } },
                { createdAt: { greater_than: pendingCutoff } },
              ],
            },
          ],
        },
      ],
    },
  })

  return Math.max(0, places - bookings.totalDocs)
}

/** Reserve or reuse pending bookings for payment intent. Returns booking IDs. */
export async function reservePendingBookings(
  payload: PayloadLike,
  opts: {
    timeslotId: number
    userId: number
    user?: unknown
    tenantId: number
    quantity: number
    /**
     * Checkout API only: user is already authenticated and amount validated (e.g. €0 confirm).
     * Bypasses booking `create` access (which requires Connect when the class has drop-in), so
     * free-checkout completion matches the payment-intent route (no Connect for zero amount).
     */
    trustedServerReservation?: boolean
  }
): Promise<string[]> {
  const { timeslotId, userId, tenantId, quantity } = opts
  const trusted = opts.trustedServerReservation === true
  const PENDING_CUTOFF_MS = 5 * 60 * 1000
  const pendingCutoff = new Date(Date.now() - PENDING_CUTOFF_MS).toISOString()

  const existing = await payload.find({
    collection: 'bookings',
    where: {
      and: [
        { timeslot: { equals: timeslotId } },
        { user: { equals: userId } },
        { status: { equals: 'pending' } },
        { createdAt: { greater_than: pendingCutoff } },
      ],
    },
    sort: 'id',
    limit: quantity,
    depth: 0,
    overrideAccess: trusted,
    user: opts.user,
  })

  const existingIds = (existing.docs as { id: number }[]).map((b) => String(b.id))
  const need = quantity - existingIds.length

  if (need > 0) {
    const timeslot = (await payload.findByID({
      collection: ATND_ME_BOOKINGS_COLLECTION_SLUGS.timeslots,
      id: timeslotId,
      depth: 1,
      overrideAccess: true,
    })) as { remainingCapacity?: number; eventType?: number | { id: number } | null } | null
    const cap =
      timeslot && typeof timeslot.remainingCapacity === 'number'
        ? Math.max(0, timeslot.remainingCapacity)
        : await computeRemainingCapacityForTimeslot(payload, timeslotId, timeslot)

    if (need > cap) {
      throw new Error(formatCapacityError(cap, quantity))
    }

    for (let i = 0; i < need; i++) {
      const created = await payload.create({
        collection: 'bookings',
        data: {
          user: userId,
          timeslot: timeslotId,
          tenant: tenantId,
          status: 'pending',
        },
        overrideAccess: trusted,
        user: opts.user,
      })
      existingIds.push(String(created.id))
    }
  }

  return existingIds.slice(0, quantity)
}
