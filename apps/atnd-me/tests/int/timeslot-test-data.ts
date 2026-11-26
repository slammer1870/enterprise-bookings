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

/**
 * Timeslot hooks combine `date` with wall-clock `startTime`/`endTime` in the tenant TZ.
 * Full ISO datetimes are unsafe near midnight: `now` + 1h can land on the next calendar day,
 * so end wall-clock is earlier than start on the same `date` → "End time must be greater than start time".
 */
export function normalizeTimeslotTestData<T extends Record<string, unknown>>(data: T): T {
  let normalized = { ...data }

  if (typeof normalized.date === 'string' && normalized.date.length > 10) {
    normalized = { ...normalized, date: normalized.date.slice(0, 10) }
  }

  const startRaw = normalized.startTime
  const endRaw = normalized.endTime
  if (typeof startRaw !== 'string' || typeof endRaw !== 'string') {
    return normalized as T
  }

  const startIsIso = startRaw.includes('T')
  const endIsIso = endRaw.includes('T')
  if (!startIsIso && !endIsIso) {
    return normalized as T
  }

  const defaults = defaultTimeslotFields(2)

  // Always coerce ISO timestamps to same-day wall clocks on a stable future date.
  // Keeping a caller `date` of "today" with ISO times is what flakes near UTC midnight.
  normalized = {
    ...normalized,
    date: defaults.date,
    startTime: defaults.startTime,
    endTime: defaults.endTime,
  }

  return normalized as T
}
