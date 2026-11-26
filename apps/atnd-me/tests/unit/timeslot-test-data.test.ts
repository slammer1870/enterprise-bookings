import { describe, expect, it } from 'vitest'
import {
  defaultTimeslotFields,
  normalizeTimeslotTestData,
} from '../int/timeslot-test-data'

describe('normalizeTimeslotTestData', () => {
  it('leaves HH:mm wall-clock times alone', () => {
    const input = {
      date: '2026-11-28',
      startTime: '10:00',
      endTime: '11:00',
      eventType: 1,
    }
    expect(normalizeTimeslotTestData(input)).toEqual(input)
  })

  it('coerces ISO datetimes that cross midnight into stable same-day wall clocks', () => {
    const late = new Date('2026-11-26T23:30:00.000Z')
    const nextHour = new Date(late.getTime() + 60 * 60 * 1000)
    const normalized = normalizeTimeslotTestData({
      date: late.toISOString(),
      startTime: late.toISOString(),
      endTime: nextHour.toISOString(),
      eventType: 42,
      lockOutTime: 60,
      active: true,
    })

    expect(normalized.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(normalized.startTime).toBe('10:00')
    expect(normalized.endTime).toBe('11:00')
    expect(normalized.eventType).toBe(42)
    expect(normalized.lockOutTime).toBe(60)
  })

  it('defaultTimeslotFields uses HH:mm on a future date', () => {
    const fields = defaultTimeslotFields(2)
    expect(fields.startTime).toBe('10:00')
    expect(fields.endTime).toBe('11:00')
    expect(fields.date >= new Date().toISOString().slice(0, 10)).toBe(true)
  })
})
