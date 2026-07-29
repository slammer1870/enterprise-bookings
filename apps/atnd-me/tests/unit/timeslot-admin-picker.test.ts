import { describe, expect, it } from 'vitest'

import { formatTimeslotAdminTitle } from '@/utilities/formatTimeslotAdminTitle'
import {
  calendarDayFromDateField,
  timeslotDateFilterBounds,
} from '@/utilities/timeslotDateFilterBounds'

describe('formatTimeslotAdminTitle', () => {
  it('formats date and 12-hour start/end times', () => {
    // 2026-07-29 18:00–19:30 UTC = 19:00–20:30 IST (Europe/Dublin summer)
    const label = formatTimeslotAdminTitle({
      startTime: '2026-07-29T18:00:00.000Z',
      endTime: '2026-07-29T19:30:00.000Z',
      timeZone: 'Europe/Dublin',
    })
    expect(label).toBe('Wed 29 Jul 2026 · 7:00 PM – 8:30 PM')
  })

  it('returns null for missing start', () => {
    expect(formatTimeslotAdminTitle({ startTime: null })).toBeNull()
  })
})

describe('timeslotDateFilterBounds', () => {
  it('extracts YYYY-MM-DD from date field values', () => {
    expect(calendarDayFromDateField('2026-07-29T00:00:00.000Z')).toBe('2026-07-29')
    expect(calendarDayFromDateField('2026-07-29')).toBe('2026-07-29')
    expect(calendarDayFromDateField(new Date('2026-07-29T00:00:00.000Z'))).toBe('2026-07-29')
  })

  it('keeps midnight-UTC dayOnly values on the picked calendar day', () => {
    // Regression: toISOString alone is fine here; local getDate() would shift in US timezones.
    expect(calendarDayFromDateField(new Date(Date.UTC(2026, 6, 29, 0, 0, 0)))).toBe('2026-07-29')
  })

  it('returns start/end ISO bounds for the calendar day in Dublin', () => {
    const bounds = timeslotDateFilterBounds('2026-07-29', 'Europe/Dublin')
    expect(bounds).not.toBeNull()
    // IST (UTC+1): 00:00 → 2026-07-28T23:00:00.000Z, 23:59:59.999 → 2026-07-29T22:59:59.999Z
    expect(bounds!.startIso).toBe('2026-07-28T23:00:00.000Z')
    expect(bounds!.endIso).toBe('2026-07-29T22:59:59.999Z')
  })
})
