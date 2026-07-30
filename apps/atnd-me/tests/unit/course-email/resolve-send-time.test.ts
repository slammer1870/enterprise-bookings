import { describe, expect, it } from 'vitest'
import {
  COURSE_EMAIL_SEND_TIMINGS,
  resolveCourseEmailSendAt,
} from '@/lib/course-email/resolve-send-time'

describe('COURSE_EMAIL_SEND_TIMINGS', () => {
  it('includes purchase and calendar-relative timings', () => {
    expect(COURSE_EMAIL_SEND_TIMINGS).toEqual(
      expect.arrayContaining([
        'after_purchase',
        'one_week_before_start',
        'one_day_before_start',
        'one_day_after_start',
        'one_day_before_end',
        'one_day_after_end',
      ]),
    )
  })
})

describe('resolveCourseEmailSendAt', () => {
  const accessStartsAt = '2026-09-08T00:00:00.000Z'
  const accessEndsAt = '2026-11-03T23:59:59.999Z'
  const timeZone = 'Europe/Dublin'

  it('returns immediate for after_purchase', () => {
    expect(
      resolveCourseEmailSendAt({
        sendTiming: 'after_purchase',
        accessStartsAt,
        accessEndsAt,
        timeZone,
        now: new Date('2026-08-01T12:00:00.000Z'),
      }),
    ).toEqual({ kind: 'immediate' })
  })

  it('schedules one week before start at 9am local', () => {
    // 2026-09-08 is a Tuesday in Dublin; one week before = 2026-09-01 09:00 IST (UTC+1) = 08:00Z
    const result = resolveCourseEmailSendAt({
      sendTiming: 'one_week_before_start',
      accessStartsAt,
      accessEndsAt,
      timeZone,
      now: new Date('2026-08-01T12:00:00.000Z'),
    })
    expect(result).toEqual({
      kind: 'scheduled',
      sendAt: new Date('2026-09-01T08:00:00.000Z'),
    })
  })

  it('schedules one day before start at 9am local', () => {
    const result = resolveCourseEmailSendAt({
      sendTiming: 'one_day_before_start',
      accessStartsAt,
      accessEndsAt,
      timeZone,
      now: new Date('2026-08-01T12:00:00.000Z'),
    })
    expect(result).toEqual({
      kind: 'scheduled',
      sendAt: new Date('2026-09-07T08:00:00.000Z'),
    })
  })

  it('schedules one day after start at 9am local', () => {
    const result = resolveCourseEmailSendAt({
      sendTiming: 'one_day_after_start',
      accessStartsAt,
      accessEndsAt,
      timeZone,
      now: new Date('2026-08-01T12:00:00.000Z'),
    })
    expect(result).toEqual({
      kind: 'scheduled',
      sendAt: new Date('2026-09-09T08:00:00.000Z'),
    })
  })

  it('schedules one day before end at 9am local', () => {
    // accessEndsAt 2026-11-03 → one day before = 2026-11-02 09:00 IST = 09:00Z (GMT in Nov)
    const result = resolveCourseEmailSendAt({
      sendTiming: 'one_day_before_end',
      accessStartsAt,
      accessEndsAt,
      timeZone,
      now: new Date('2026-08-01T12:00:00.000Z'),
    })
    expect(result).toEqual({
      kind: 'scheduled',
      sendAt: new Date('2026-11-02T09:00:00.000Z'),
    })
  })

  it('schedules one day after end at 9am local', () => {
    const result = resolveCourseEmailSendAt({
      sendTiming: 'one_day_after_end',
      accessStartsAt,
      accessEndsAt,
      timeZone,
      now: new Date('2026-08-01T12:00:00.000Z'),
    })
    expect(result).toEqual({
      kind: 'scheduled',
      sendAt: new Date('2026-11-04T09:00:00.000Z'),
    })
  })

  it('skips scheduled timings whose send time is already past', () => {
    expect(
      resolveCourseEmailSendAt({
        sendTiming: 'one_day_before_start',
        accessStartsAt,
        accessEndsAt,
        timeZone,
        now: new Date('2026-09-07T10:00:00.000Z'),
      }),
    ).toEqual({ kind: 'skip', reason: 'send_time_past' })
  })
})
