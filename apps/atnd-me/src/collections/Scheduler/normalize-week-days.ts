import { extractUtcWallClock } from '@repo/shared-utils'

type SchedulerTimeSlot = {
  id?: unknown
  startTime?: unknown
  endTime?: unknown
  [key: string]: unknown
}

type SchedulerDay = {
  timeSlot?: SchedulerTimeSlot[] | null
  [key: string]: unknown
}

function toTimeSlotRowId(value: unknown): string | null {
  if (value == null || value === '') return null
  return String(value)
}

/** True when a template row has valid wall-clock start/end times worth persisting. */
export function isCompleteSchedulerTimeSlot(slot: unknown): boolean {
  if (slot == null || typeof slot !== 'object') return false

  const { startTime, endTime } = slot as SchedulerTimeSlot
  if (startTime == null || startTime === '' || endTime == null || endTime === '') {
    return false
  }

  const start = new Date(startTime as string | number | Date)
  const end = new Date(endTime as string | number | Date)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false
  if (end <= start) return false

  return true
}

export function buildExistingTimeSlotIdsByDay(days: unknown): Map<number, Set<string>> {
  const map = new Map<number, Set<string>>()
  if (!Array.isArray(days)) return map

  days.forEach((day, dayIndex) => {
    if (!day || typeof day !== 'object') return
    const timeSlot = (day as SchedulerDay).timeSlot
    if (!Array.isArray(timeSlot)) return

    const ids = new Set<string>()
    for (const slot of timeSlot) {
      const id = toTimeSlotRowId(slot?.id)
      if (id) ids.add(id)
    }
    map.set(dayIndex, ids)
  })

  return map
}

/**
 * Nested scheduler `timeSlot` rows use string UUID primary keys in Postgres.
 * Keep ids that already exist in the DB so Payload updates rows in place.
 * Strip ids only for brand-new rows, create operations, or duplicate copies in
 * the same submission (Payload's duplicate-row feature reuses the source id).
 */
export function dedupeSchedulerTimeSlotIds(
  slots: SchedulerTimeSlot[],
  args: {
    operation: 'create' | 'update'
    existingIds?: Set<string>
  },
): SchedulerTimeSlot[] {
  const seenSubmissionIds = new Set<string>()

  return slots.map((slot) => {
    const id = toTimeSlotRowId(slot?.id)
    if (id == null) return slot

    const isDuplicateInSubmission = seenSubmissionIds.has(id)
    const existsInDb =
      args.operation === 'update' && (args.existingIds?.has(id) ?? false)

    if (args.operation === 'create' || isDuplicateInSubmission || !existsInDb) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id: _id, ...rest } = slot
      return rest
    }

    seenSubmissionIds.add(id)
    return slot
  })
}

export function normalizeSchedulerWeekDays(
  days: SchedulerDay[],
  args: {
    operation: 'create' | 'update'
    existingIdsByDay: Map<number, Set<string>>
  },
): SchedulerDay[] {
  return days.map((day, dayIndex) => {
    if (!day?.timeSlot || !Array.isArray(day.timeSlot)) return day

    const filtered = day.timeSlot.filter(isCompleteSchedulerTimeSlot)
    filtered.sort((a, b) => {
      const at = extractUtcWallClock(a.startTime as string)
      const bt = extractUtcWallClock(b.startTime as string)
      return at.hours * 60 + at.minutes - (bt.hours * 60 + bt.minutes)
    })

    const deduped = dedupeSchedulerTimeSlotIds(filtered, {
      operation: args.operation,
      existingIds: args.existingIdsByDay.get(dayIndex),
    })

    return { ...day, timeSlot: deduped }
  })
}
