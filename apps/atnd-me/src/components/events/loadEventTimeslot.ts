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
  type EventPageStaffMember,
  relationId,
} from '@/components/events/eventPageTypes'

function sanitizeStaffMember(value: unknown): EventPageStaffMember | number | null {
  if (value == null) return null
  const id = relationId(value)
  if (id == null) return null
  if (typeof value !== 'object') return id

  const doc = value as {
    id?: unknown
    name?: unknown
    image?: { url?: string | null } | number | null
  }
  const profileImage =
    doc.image && typeof doc.image === 'object' && typeof doc.image.url === 'string'
      ? { url: doc.image.url }
      : null

  return {
    id,
    name: typeof doc.name === 'string' ? doc.name : null,
    profileImage,
  }
}

export async function loadEventTimeslot(id: number): Promise<EventPageTimeslot | null> {
  const payload = await getPayload()
  const headersList = await headers()
  const tenant = await getTenantWithBranding(payload, { headers: headersList })

  // depth 2 for eventType/branch/media; staff is re-loaded narrowly below
  const timeslot = (await payload
    .findByID({
      collection: ATND_ME_BOOKINGS_COLLECTION_SLUGS.timeslots,
      id,
      depth: 2,
      overrideAccess: true,
    })
    .catch(() => null)) as EventPageTimeslot | null

  if (!timeslot || timeslot.active === false) return null

  const timeslotTenantId = relationId(timeslot.tenant)
  if (tenant?.id != null && timeslotTenantId != null && tenant.id !== timeslotTenantId) {
    return null
  }

  const staffId = relationId(timeslot.staffMember)
  let staffMember: EventPageStaffMember | number | null = staffId
  if (staffId != null) {
    const staffUser = await payload
      .findByID({
        collection: 'users',
        id: staffId,
        depth: 1,
        overrideAccess: true,
        select: {
          id: true,
          name: true,
          image: true,
        } as any,
      })
      .catch(() => null)
    staffMember = sanitizeStaffMember(staffUser) ?? staffId
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
    staffMember,
    remainingCapacity: capacity.remaining,
    remainingConfirmedOnly: capacity.remainingConfirmedOnly,
    ownHoldQuantity,
  }
}
