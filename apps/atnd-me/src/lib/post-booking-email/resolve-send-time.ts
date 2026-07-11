import { TZDate } from '@date-fns/tz'
import { getZonedDateParts } from '@repo/shared-utils'

const NEXT_DAY_SEND_HOUR = 9

export function resolveNextDay9am(
  confirmedAt: Date | string | number,
  timeZone: string,
): Date {
  const { year, month, date } = getZonedDateParts(confirmedAt, timeZone)
  return new TZDate(year, month, date + 1, NEXT_DAY_SEND_HOUR, 0, 0, 0, timeZone)
}
