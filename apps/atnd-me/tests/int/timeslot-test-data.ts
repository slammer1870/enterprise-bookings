/** Stable wall-clock timeslot fields for int tests (avoids End Time validation / DST issues). */
export function defaultTimeslotFields(offsetDays = 2) {
  const baseDate = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000)
  return {
    date: baseDate.toISOString().slice(0, 10),
    startTime: '10:00',
    endTime: '11:00',
    lockOutTime: 0,
    active: true,
  }
}

export function normalizeTimeslotTestData<T extends Record<string, unknown>>(data: T): T {
  let normalized = { ...data }

  if (typeof normalized.date === 'string' && normalized.date.length > 10) {
    normalized = { ...normalized, date: normalized.date.slice(0, 10) }
  }

  const startRaw = normalized.startTime
  const endRaw = normalized.endTime
  if (typeof startRaw === 'string' && typeof endRaw === 'string' && startRaw.includes('T')) {
    const start = new Date(startRaw)
    const end = new Date(endRaw)
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end <= start) {
      const defaults = defaultTimeslotFields()
      normalized = {
        ...defaults,
        ...normalized,
        date:
          typeof normalized.date === 'string' && normalized.date.length === 10
            ? normalized.date
            : defaults.date,
        startTime: defaults.startTime,
        endTime: defaults.endTime,
      }
    }
  }

  return normalized as T
}
