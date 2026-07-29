import { formatInTimeZone, resolveTimeZone } from '@repo/shared-utils/timezone'

/**
 * Human-readable timeslot label for admin relationship pickers / useAsTitle.
 * Example: "Wed 29 Jul 2026 · 7:00 PM – 8:30 PM"
 */
export function formatTimeslotAdminTitle(args: {
  startTime?: string | Date | null
  endTime?: string | Date | null
  timeZone?: string | null
}): string | null {
  const { startTime, endTime, timeZone } = args
  if (startTime == null || startTime === '') return null

  const tz = resolveTimeZone(timeZone)
  const start = new Date(startTime)
  if (Number.isNaN(start.getTime())) return null

  const datePart = formatInTimeZone(start, 'EEE d MMM yyyy', tz)
  const startPart = formatInTimeZone(start, 'h:mm a', tz)

  if (endTime == null || endTime === '') {
    return `${datePart} · ${startPart}`
  }

  const end = new Date(endTime)
  if (Number.isNaN(end.getTime())) {
    return `${datePart} · ${startPart}`
  }

  const endPart = formatInTimeZone(end, 'h:mm a', tz)
  return `${datePart} · ${startPart} – ${endPart}`
}
