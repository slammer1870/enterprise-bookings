import { headers } from 'next/headers'

import { getPayload } from '@/lib/payload'
import { getTenantWithBranding } from '@/utilities/getTenantContext'
import { ATND_ME_BOOKINGS_COLLECTION_SLUGS } from '@/constants/bookings-collection-slugs'
import {
  computeCapacityBreakdownWithHolds,
  getActiveCheckoutHold,
  CHECKOUT_HOLD_COLLECTION_SLUG,
} from '@repo/bookings-payments'
import { currentUser } from '@/lib/auth/context/get-context-props'
import {
  type EventPageTimeslot,
  relationId,
} from '@/components/events/eventPageTypes'

export async function loadEventTimeslot(id: number): Promise<EventPageTimeslot | null> {
  const payload = await getPayload()
  const headersList = await headers()
  const tenant = await getTenantWithBranding(payload, { headers: headersList })

  const timeslot = (await payload
    .findByID({
      collection: ATND_ME_BOOKINGS_COLLECTION_SLUGS.timeslots,
      id,
      depth: 3,
      overrideAccess: true,
    })
    .catch(() => null)) as EventPageTimeslot | null

  if (!timeslot || timeslot.active === false) return null

  const timeslotTenantId = relationId(timeslot.tenant)
  if (tenant?.id != null && timeslotTenantId != null && tenant.id !== timeslotTenantId) {
    return null
  }

  const capacity = await computeCapacityBreakdownWithHolds(payload, id, {
    timeslotsSlug: ATND_ME_BOOKINGS_COLLECTION_SLUGS.timeslots,
    eventTypesSlug: ATND_ME_BOOKINGS_COLLECTION_SLUGS.eventTypes,
    bookingsSlug: ATND_ME_BOOKINGS_COLLECTION_SLUGS.bookings,
    holdCollection: CHECKOUT_HOLD_COLLECTION_SLUG,
  })

  let ownHoldQuantity = 0
  const user = await currentUser()
  if (user?.id != null) {
    const hold = await getActiveCheckoutHold(payload, {
      timeslotId: id,
      userId: Number(user.id),
      holdCollection: CHECKOUT_HOLD_COLLECTION_SLUG,
    })
    if (hold) {
      ownHoldQuantity = Math.max(0, Number(hold.quantity) || 0)
    }
  }

  return {
    ...timeslot,
    remainingCapacity: capacity.remaining,
    remainingConfirmedOnly: capacity.remainingConfirmedOnly,
    ownHoldQuantity,
  }
}
