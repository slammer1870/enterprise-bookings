import { getPayload } from '@/lib/payload'
import { ATND_ME_BOOKINGS_COLLECTION_SLUGS } from '@/constants/bookings-collection-slugs'

/**
 * Current `remainingCapacity` for a timeslot.
 *
 * Same virtual field as the booking page's first read. A reload can release the
 * viewer's checkout hold after that read and before the hold is recorded, so the
 * places label has to ask again once it knows the hold is gone.
 */
export async function readLiveRemainingCapacity(timeslotId: number): Promise<number | null> {
  const payload = await getPayload()
  const doc = (await payload.findByID({
    collection: ATND_ME_BOOKINGS_COLLECTION_SLUGS.timeslots,
    id: timeslotId,
    depth: 0,
    overrideAccess: true,
  })) as { remainingCapacity?: unknown }

  const raw = doc.remainingCapacity
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN
  if (!Number.isFinite(n)) return null
  return Math.max(0, n)
}
