import { TZDate } from '@date-fns/tz'
import { getZonedDateParts } from '@repo/shared-utils'

const NEXT_DAY_SEND_HOUR = 9

/**
 * 9:00 local on the calendar day after `anchorAt` (typically the timeslot start).
 */
export function resolveNextDay9am(
  anchorAt: Date | string | number,
  timeZone: string,
): Date {
  const { year, month, date } = getZonedDateParts(anchorAt, timeZone)
  return new TZDate(year, month, date + 1, NEXT_DAY_SEND_HOUR, 0, 0, 0, timeZone)
}
