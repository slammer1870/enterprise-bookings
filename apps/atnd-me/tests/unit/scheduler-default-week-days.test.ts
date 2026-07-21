import { describe, expect, it } from 'vitest'

import {
  defaultSchedulerWeekDays,
  ensureSevenSchedulerWeekDays,
} from '@/collections/Scheduler/default-week-days'

describe('scheduler default week days', () => {
  it('defaults to 7 empty Mon–Sun day rows', () => {
    const days = defaultSchedulerWeekDays()
    expect(days).toHaveLength(7)
    expect(days.every((day) => Array.isArray(day.timeSlot) && day.timeSlot.length === 0)).toBe(
      true,
    )
  })

  it('pads partial week templates to 7 days without dropping existing slots', () => {
    const padded = ensureSevenSchedulerWeekDays([
      { timeSlot: [{ startTime: 'x' }] },
      { timeSlot: [] },
    ])
    expect(padded).toHaveLength(7)
    expect(padded[0]?.timeSlot).toEqual([{ startTime: 'x' }])
    expect(padded[2]?.timeSlot).toEqual([])
  })
})
