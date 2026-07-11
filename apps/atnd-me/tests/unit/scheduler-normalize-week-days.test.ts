import { describe, expect, it } from 'vitest'

import {
  buildExistingTimeSlotIdsByDay,
  dedupeSchedulerTimeSlotIds,
  isCompleteSchedulerTimeSlot,
  normalizeSchedulerWeekDays,
} from '@/collections/Scheduler/normalize-week-days'

const start = '2026-06-16T09:00:00.000Z'
const end = '2026-06-16T10:00:00.000Z'

describe('isCompleteSchedulerTimeSlot', () => {
  it('rejects rows missing start or end', () => {
    expect(isCompleteSchedulerTimeSlot({ startTime: start })).toBe(false)
    expect(isCompleteSchedulerTimeSlot({ endTime: end })).toBe(false)
    expect(isCompleteSchedulerTimeSlot({})).toBe(false)
  })

  it('rejects invalid or non-increasing ranges', () => {
    expect(
      isCompleteSchedulerTimeSlot({ startTime: 'not-a-date', endTime: end }),
    ).toBe(false)
    expect(
      isCompleteSchedulerTimeSlot({ startTime: end, endTime: start }),
    ).toBe(false)
  })

  it('accepts valid template rows', () => {
    expect(isCompleteSchedulerTimeSlot({ startTime: start, endTime: end })).toBe(
      true,
    )
  })
})

describe('dedupeSchedulerTimeSlotIds', () => {
  it('strips all ids on create', () => {
    const result = dedupeSchedulerTimeSlotIds(
      [{ id: 'existing-uuid', startTime: start, endTime: end }],
      { operation: 'create' },
    )

    expect(result[0]?.id).toBeUndefined()
  })

  it('keeps existing DB ids on update', () => {
    const result = dedupeSchedulerTimeSlotIds(
      [{ id: 'existing-uuid', startTime: start, endTime: end }],
      {
        operation: 'update',
        existingIds: new Set(['existing-uuid']),
      },
    )

    expect(result[0]?.id).toBe('existing-uuid')
  })

  it('strips client-only ids on update so Payload inserts new rows', () => {
    const result = dedupeSchedulerTimeSlotIds(
      [{ id: 'client-only-uuid', startTime: start, endTime: end }],
      {
        operation: 'update',
        existingIds: new Set(['existing-uuid']),
      },
    )

    expect(result[0]?.id).toBeUndefined()
  })

  it('strips duplicate ids within the same submission', () => {
    const result = dedupeSchedulerTimeSlotIds(
      [
        { id: 'shared-uuid', startTime: start, endTime: end },
        { id: 'shared-uuid', startTime: start, endTime: end },
      ],
      {
        operation: 'update',
        existingIds: new Set(['shared-uuid']),
      },
    )

    expect(result[0]?.id).toBe('shared-uuid')
    expect(result[1]?.id).toBeUndefined()
  })
})

describe('normalizeSchedulerWeekDays', () => {
  it('drops incomplete rows and preserves existing ids across saves', () => {
    const existingIdsByDay = buildExistingTimeSlotIdsByDay([
      {
        timeSlot: [{ id: 'slot-1', startTime: start, endTime: end }],
      },
    ])

    const normalized = normalizeSchedulerWeekDays(
      [
        {
          timeSlot: [
            { id: 'slot-1', startTime: start, endTime: end },
            { id: 'client-new', startTime: start, endTime: end },
            { startTime: null, endTime: null },
          ],
        },
      ],
      { operation: 'update', existingIdsByDay },
    )

    expect(normalized[0]?.timeSlot).toHaveLength(2)
    expect(normalized[0]?.timeSlot?.[0]?.id).toBe('slot-1')
    expect(normalized[0]?.timeSlot?.[1]?.id).toBeUndefined()
  })
})
