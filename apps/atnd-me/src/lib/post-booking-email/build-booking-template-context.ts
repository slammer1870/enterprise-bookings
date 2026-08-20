import type { BasePayload } from 'payload'
import { formatInTimeZone, resolveTimeslotTimeZone } from '@repo/shared-utils'
import { ATND_ME_BOOKINGS_COLLECTION_SLUGS } from '@/constants/bookings-collection-slugs'
import type { TemplateContext } from './replace-template-vars'

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object') {
    return value as Record<string, unknown>
  }
  return null
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function relationName(value: unknown): string {
  const record = asRecord(value)
  return record ? asString(record.name) : ''
}

function relationEmail(value: unknown): string {
  const record = asRecord(value)
  return record ? asString(record.email) : ''
}

function formatTimeslotFields(timeslot: Record<string, unknown>): {
  date: string
  startTime: string
  endTime: string
  location: string
  eventType: { name: string; description: string }
  staffMember: { name: string; email: string }
  branch: { name: string }
} {
  const timeZone = resolveTimeslotTimeZone(
    timeslot as Parameters<typeof resolveTimeslotTimeZone>[0],
  )
  const startRaw = timeslot.startTime
  const endRaw = timeslot.endTime
  const dateRaw = timeslot.date

  const startTime =
    typeof startRaw === 'string' || startRaw instanceof Date
      ? formatInTimeZone(startRaw, 'h:mm a', timeZone)
      : ''
  const endTime =
    typeof endRaw === 'string' || endRaw instanceof Date
      ? formatInTimeZone(endRaw, 'h:mm a', timeZone)
      : ''

  let date = ''
  if (typeof startRaw === 'string' || startRaw instanceof Date) {
    date = formatInTimeZone(startRaw, 'EEEE, d MMMM yyyy', timeZone)
  } else if (typeof dateRaw === 'string' || dateRaw instanceof Date) {
    date = formatInTimeZone(dateRaw, 'EEEE, d MMMM yyyy', timeZone)
  }

  const eventType = asRecord(timeslot.eventType)

  return {
    date,
    startTime,
    endTime,
    location: asString(timeslot.location),
    eventType: {
      name: eventType ? asString(eventType.name) : '',
      description: eventType ? asString(eventType.description) : '',
    },
    staffMember: {
      name: relationName(timeslot.staffMember),
      email: relationEmail(timeslot.staffMember),
    },
    branch: {
      name: relationName(timeslot.branch),
    },
  }
}

export function shapeBookingTemplateContext(booking: unknown): TemplateContext {
  const record = asRecord(booking)
  if (!record) {
    return { booking: {} }
  }

  const user = asRecord(record.user)
  const timeslot = asRecord(record.timeslot)
  const tenant = asRecord(record.tenant)
  // Prefer timeslot.tenant for TZ; fall back to booking.tenant when only an id was populated.
  const timeslotForFormatting =
    timeslot && tenant && !asRecord(timeslot.tenant)
      ? { ...timeslot, tenant }
      : timeslot

  return {
    booking: {
      id: record.id != null ? String(record.id) : '',
      status: asString(record.status),
      user: {
        name: user ? asString(user.name) : '',
        email: user ? asString(user.email) : '',
      },
      timeslot: timeslotForFormatting
        ? formatTimeslotFields(timeslotForFormatting)
        : {
            date: '',
            startTime: '',
            endTime: '',
            location: '',
            eventType: { name: '', description: '' },
            staffMember: { name: '', email: '' },
            branch: { name: '' },
          },
      tenant: {
        name: tenant ? asString(tenant.name) : '',
        slug: tenant ? asString(tenant.slug) : '',
      },
    },
  }
}

export async function loadBookingTemplateContext(
  payload: BasePayload,
  bookingId: number,
): Promise<TemplateContext | null> {
  let lastError: unknown

  // Immediate post-booking sends run outside the create request's event loop.
  // Retry briefly so a just-committed booking is visible before rendering
  // relationship-based placeholders.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const booking = await payload.findByID({
        collection: ATND_ME_BOOKINGS_COLLECTION_SLUGS.bookings,
        id: bookingId,
        depth: 2,
        overrideAccess: true,
      })

      return shapeBookingTemplateContext(booking)
    } catch (error) {
      lastError = error
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)))
      }
    }
  }

  payload.logger.warn(
    `[post-booking-email] Could not load template context for booking ${bookingId}: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  )
  return null
}
