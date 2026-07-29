import { getDayBoundsInTimeZone, resolveTimeZone } from '@repo/shared-utils/timezone'

/**
 * Extract a calendar YYYY-MM-DD from a Payload date field value (day picker).
 * Prefers the leading date segment so dayOnly midnight-UTC values keep the picked day.
 */
export function calendarDayFromDateField(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/)
    return match?.[1] ?? null
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    // dayOnly values are usually midnight UTC for the picked calendar day.
    // Prefer UTC parts so Europe/Dublin does not shift the day via toISOString alone.
    if (
      value.getUTCHours() === 0 &&
      value.getUTCMinutes() === 0 &&
      value.getUTCSeconds() === 0
    ) {
      return value.toISOString().slice(0, 10)
    }
    // Full datetimes (e.g. timeslot startTime): use the UTC calendar day of the instant
    // only as a last resort — callers that care about tenant TZ should format explicitly.
    // For seeding from startTime we still want a stable YYYY-MM-DD; use UTC date parts
    // consistent with how filter bounds noon-anchor works after string extraction.
    const y = value.getUTCFullYear()
    const m = String(value.getUTCMonth() + 1).padStart(2, '0')
    const d = String(value.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  return null
}

/**
 * Start/end ISO bounds for filtering timeslots that fall on a calendar day
 * in the given (or default) timezone.
 */
export function timeslotDateFilterBounds(
  dateFieldValue: unknown,
  timeZone?: string | null,
): { startIso: string; endIso: string } | null {
  const day = calendarDayFromDateField(dateFieldValue)
  if (!day) return null

  const tz = resolveTimeZone(timeZone)
  // Noon UTC keeps getZonedDateParts on the intended calendar day across common TZs.
  const { startOfDay, endOfDay } = getDayBoundsInTimeZone(`${day}T12:00:00.000Z`, tz)
  return {
    // Normalize to UTC Z so Payload/Postgres comparisons stay consistent.
    startIso: new Date(startOfDay.getTime()).toISOString(),
    endIso: new Date(endOfDay.getTime()).toISOString(),
  }
}
