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

  it('anchors still-open midnight-crossing windows to the end day', () => {
    const end = new Date(Date.now() + 30 * 60 * 1000)
    const start = new Date(end.getTime() - 60 * 60 * 1000)
    // Force a day boundary even if the natural ±30m window is same-day.
    if (start.toISOString().slice(0, 10) === end.toISOString().slice(0, 10)) {
      start.setTime(Date.UTC(
        end.getUTCFullYear(),
        end.getUTCMonth(),
        end.getUTCDate() - 1,
        23,
        30,
        0,
        0,
      ))
    }

    const normalized = normalizeTimeslotTestData({
      date: start.toISOString(),
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      eventType: 42,
      lockOutTime: 0,
    })

    const endMins = end.getUTCHours() * 60 + end.getUTCMinutes()
    expect(normalized.date).toBe(end.toISOString().slice(0, 10))
    expect(normalized.startTime).toBe('00:00')
    expect(normalized.endTime).toBe(
      `${String(Math.floor(Math.max(endMins, 1) / 60)).padStart(2, '0')}:${String(Math.max(endMins, 1) % 60).padStart(2, '0')}`,
    )
    expect(normalized.eventType).toBe(42)
  })

  it('clamps past midnight-crossing windows onto the start day ending 23:59', () => {
    const start = new Date('2020-01-01T23:30:00.000Z')
    const end = new Date('2020-01-02T00:30:00.000Z')
    const normalized = normalizeTimeslotTestData({
      date: start.toISOString(),
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      eventType: 9,
    })

    expect(normalized.date).toBe('2020-01-01')
    expect(normalized.startTime).toBe('23:30')
    expect(normalized.endTime).toBe('23:59')
  })

  it('defaultTimeslotFields uses HH:mm on a future date', () => {
    const fields = defaultTimeslotFields(2)
    expect(fields.startTime).toBe('10:00')
    expect(fields.endTime).toBe('11:00')
    expect(fields.date >= new Date().toISOString().slice(0, 10)).toBe(true)
  })
})
