/**
 * Helpers for create-payment-intent API: validate booking IDs, reserve pending capacity.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PayloadLike = any

/** Validate and resolve explicit booking IDs from metadata (modify-booking flow). */
export async function validateBookingIdsFromMetadata(
  payload: PayloadLike,
  metadata: { bookingIds?: string },
  opts: { lessonId: number; userId: number }
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
        { lesson: { equals: opts.lessonId } },
        { user: { equals: opts.userId } },
        { status: { equals: 'pending' } },
      ],
    },
    depth: 0,
    limit: parsed.length,
    overrideAccess: true,
  })

  return (docs.docs as { id: number }[]).map((b) => String(b.id))
}

/** Format capacity error message. */
export function formatCapacityError(remaining: number, requested: number): string {
  if (remaining === 0) return 'This lesson is fully booked.'
  return `Only ${remaining} spot${remaining !== 1 ? 's' : ''} available. You requested ${requested}.`
}

/** Reserve or reuse pending bookings for payment intent. Returns booking IDs. */
export async function reservePendingBookings(
  payload: PayloadLike,
  opts: {
    lessonId: number
    userId: number
    tenantId: number
    quantity: number
  }
): Promise<string[]> {
  const { lessonId, userId, tenantId, quantity } = opts
  const PENDING_CUTOFF_MS = 5 * 60 * 1000
  const pendingCutoff = new Date(Date.now() - PENDING_CUTOFF_MS).toISOString()

  const existing = await payload.find({
    collection: 'bookings',
    where: {
      and: [
        { lesson: { equals: lessonId } },
        { user: { equals: userId } },
        { status: { equals: 'pending' } },
        { createdAt: { greater_than: pendingCutoff } },
      ],
    },
    sort: 'id',
    limit: quantity,
    depth: 0,
    overrideAccess: true,
  })

  const existingIds = (existing.docs as { id: number }[]).map((b) => String(b.id))
  const need = quantity - existingIds.length

  if (need > 0) {
    const lesson = (await payload.findByID({
      collection: 'lessons',
      id: lessonId,
      depth: 1,
      overrideAccess: true,
    })) as { remainingCapacity?: number } | null
    const cap =
      lesson && typeof lesson.remainingCapacity === 'number'
        ? Math.max(0, lesson.remainingCapacity)
        : 0

    if (need > cap) {
      throw new Error(formatCapacityError(cap, quantity))
    }

    for (let i = 0; i < need; i++) {
      const created = await payload.create({
        collection: 'bookings',
        data: {
          user: userId,
          lesson: lessonId,
          tenant: tenantId,
          status: 'pending',
        },
        overrideAccess: true,
      })
      existingIds.push(String(created.id))
    }
  }

  return existingIds.slice(0, quantity)
}
