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

  it('preserves relative in-progress ISO windows that stay on one UTC day', () => {
    const start = new Date('2026-11-26T15:00:00.000Z')
    const end = new Date('2026-11-26T16:00:00.000Z')
    const normalized = normalizeTimeslotTestData({
      date: start.toISOString().slice(0, 10),
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      eventType: 7,
    })

    expect(normalized).toMatchObject({
      date: '2026-11-26',
      startTime: '15:00',
      endTime: '16:00',
      eventType: 7,
    })
  })

  it('clamps midnight-crossing ISO windows onto the same day without rewriting to 10:00', () => {
    const late = new Date('2026-11-26T23:30:00.000Z')
    const nextHour = new Date(late.getTime() + 60 * 60 * 1000)
    const normalized = normalizeTimeslotTestData({
      date: late.toISOString(),
      startTime: late.toISOString(),
      endTime: nextHour.toISOString(),
      eventType: 42,
      lockOutTime: 0,
      active: true,
    })

    expect(normalized.date).toBe('2026-11-26')
    expect(normalized.startTime).toBe('23:30')
    expect(normalized.endTime).toBe('23:59')
    expect(normalized.eventType).toBe(42)
  })

  it('defaultTimeslotFields uses HH:mm on a future date', () => {
    const fields = defaultTimeslotFields(2)
    expect(fields.startTime).toBe('10:00')
    expect(fields.endTime).toBe('11:00')
    expect(fields.date >= new Date().toISOString().slice(0, 10)).toBe(true)
  })
})
