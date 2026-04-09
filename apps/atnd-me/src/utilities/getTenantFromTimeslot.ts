/**
 * Step 3 – Get tenant from timeslot (for payment validation and tenant context).
 * Returns tenant id from a timeslot doc or by loading the timeslot by id.
 */
import type { Payload } from 'payload'

import { ATND_ME_BOOKINGS_COLLECTION_SLUGS } from '@/constants/bookings-collection-slugs'

type TimeslotLike = { id?: number; tenant?: number | { id: number } | null }

export async function getTenantFromTimeslot(
  payload: Payload,
  timeslotOrTimeslotId: number | TimeslotLike,
): Promise<number | null> {
  let timeslot: TimeslotLike | null = null
  if (typeof timeslotOrTimeslotId === 'number') {
    const doc = await payload.findByID({
      collection: ATND_ME_BOOKINGS_COLLECTION_SLUGS.timeslots,
      id: timeslotOrTimeslotId,
      depth: 0,
      overrideAccess: true,
      context: { triggerAfterChange: false },
      select: { tenant: true } as any,
    })
    timeslot = doc as TimeslotLike
  } else {
    timeslot = timeslotOrTimeslotId
  }
  if (!timeslot) return null
  const raw = timeslot.tenant
  if (raw == null) return null
  if (typeof raw === 'number') return raw
  if (typeof raw === 'object' && raw !== null && 'id' in raw) return raw.id
  return null
}
