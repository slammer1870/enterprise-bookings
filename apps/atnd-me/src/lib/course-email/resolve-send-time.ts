import { TZDate } from '@date-fns/tz'
import { getZonedDateParts } from '@repo/shared-utils'

export const COURSE_EMAIL_SEND_TIMINGS = [
  'after_purchase',
  'one_week_before_start',
  'one_day_before_start',
  'one_day_after_start',
  'one_day_before_end',
  'one_day_after_end',
] as const

export type CourseEmailSendTiming = (typeof COURSE_EMAIL_SEND_TIMINGS)[number]

const SEND_HOUR = 9

export type ResolveCourseEmailSendAtArgs = {
  sendTiming: CourseEmailSendTiming
  accessStartsAt: string
  accessEndsAt: string
  timeZone: string
  now?: Date
}

export type ResolveCourseEmailSendAtResult =
  | { kind: 'immediate' }
  | { kind: 'scheduled'; sendAt: Date }
  | { kind: 'skip'; reason: 'send_time_past' }

function atLocal9amRelativeTo(
  anchorIso: string,
  timeZone: string,
  dayOffset: number,
): Date {
  const { year, month, date } = getZonedDateParts(anchorIso, timeZone)
  return new TZDate(year, month, date + dayOffset, SEND_HOUR, 0, 0, 0, timeZone)
}

/**
 * Resolve when a course email should send.
 * Calendar timings use enrollment access window + 9:00 local (same as post-booking next-day).
 */
export function resolveCourseEmailSendAt(
  args: ResolveCourseEmailSendAtArgs,
): ResolveCourseEmailSendAtResult {
  const { sendTiming, accessStartsAt, accessEndsAt, timeZone } = args
  const now = args.now ?? new Date()

  if (sendTiming === 'after_purchase') {
    return { kind: 'immediate' }
  }

  let sendAt: Date
  switch (sendTiming) {
    case 'one_week_before_start':
      sendAt = atLocal9amRelativeTo(accessStartsAt, timeZone, -7)
      break
    case 'one_day_before_start':
      sendAt = atLocal9amRelativeTo(accessStartsAt, timeZone, -1)
      break
    case 'one_day_after_start':
      sendAt = atLocal9amRelativeTo(accessStartsAt, timeZone, 1)
      break
    case 'one_day_before_end':
      sendAt = atLocal9amRelativeTo(accessEndsAt, timeZone, -1)
      break
    case 'one_day_after_end':
      sendAt = atLocal9amRelativeTo(accessEndsAt, timeZone, 1)
      break
    default: {
      const _exhaustive: never = sendTiming
      throw new Error(`Unknown course email sendTiming: ${_exhaustive}`)
    }
  }

  if (sendAt.getTime() <= now.getTime()) {
    return { kind: 'skip', reason: 'send_time_past' }
  }

  return { kind: 'scheduled', sendAt }
}
