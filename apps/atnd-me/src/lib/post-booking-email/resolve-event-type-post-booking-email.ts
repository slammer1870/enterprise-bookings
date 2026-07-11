import type { PayloadRequest } from 'payload'
import { ATND_ME_BOOKINGS_COLLECTION_SLUGS } from '@/constants/bookings-collection-slugs'
import type { PostBookingEmailConfig } from './types'
import { resolveActivePostBookingEmailConfigs } from './types'

function relationId(value: unknown): number | null {
  if (value == null) return null
  if (typeof value === 'object' && value !== null && 'id' in value) {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'number') return id
    if (typeof id === 'string' && /^\d+$/.test(id)) return parseInt(id, 10)
  }
  if (typeof value === 'number') return value
  if (typeof value === 'string' && /^\d+$/.test(value)) return parseInt(value, 10)
  return null
}

export type ResolvedEventTypePostBookingEmails = {
  eventTypeId: number
  timeslotId: number
  configs: Array<
    PostBookingEmailConfig & {
      id: string
      subject: string
      replyTo: string
      sendTiming: NonNullable<PostBookingEmailConfig['sendTiming']>
    }
  >
}

export async function resolveEventTypeIdFromBooking(
  req: PayloadRequest,
  booking: {
    timeslot?: unknown
  },
): Promise<{ eventTypeId: number; timeslotId: number } | null> {
  const timeslotId = relationId(booking.timeslot)
  if (timeslotId == null) return null

  const timeslot = await req.payload.findByID({
    collection: ATND_ME_BOOKINGS_COLLECTION_SLUGS.timeslots,
    id: timeslotId,
    depth: 1,
    overrideAccess: true,
  })

  const eventTypeId = relationId((timeslot as { eventType?: unknown })?.eventType)
  if (eventTypeId == null) return null

  return { eventTypeId, timeslotId }
}

export async function resolveEventTypePostBookingEmailsForBooking(
  req: PayloadRequest,
  booking: {
    timeslot?: unknown
  },
): Promise<ResolvedEventTypePostBookingEmails | null> {
  const resolved = await resolveEventTypeIdFromBooking(req, booking)
  if (!resolved) return null

  const eventType = await req.payload.findByID({
    collection: ATND_ME_BOOKINGS_COLLECTION_SLUGS.eventTypes,
    id: resolved.eventTypeId,
    depth: 0,
    overrideAccess: true,
  })

  const configs = resolveActivePostBookingEmailConfigs(
    eventType as { postBookingEmails?: PostBookingEmailConfig[] | null },
  )
  if (configs.length === 0) return null

  return {
    eventTypeId: resolved.eventTypeId,
    timeslotId: resolved.timeslotId,
    configs,
  }
}
