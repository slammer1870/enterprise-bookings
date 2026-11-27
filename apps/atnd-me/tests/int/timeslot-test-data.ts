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

function formatMins(totalMins: number): string {
  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function parseTimeParts(raw: string): { minutes: number; dayKey: string | null } | null {
  if (!raw.includes('T')) {
    const match = /^(\d{1,2}):(\d{2})/.exec(raw.trim())
    if (!match) return null
    const h = Number(match[1])
    const m = Number(match[2])
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null
    return { minutes: h * 60 + m, dayKey: null }
  }

  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return null
  // Tests typically use `toISOString()`; int tenants are Europe/Dublin (UTC in winter).
  // Using UTC components keeps relative past/in-progress windows intact.
  return {
    minutes: d.getUTCHours() * 60 + d.getUTCMinutes(),
    dayKey: d.toISOString().slice(0, 10),
  }
}

/**
 * Timeslot hooks combine `date` with wall-clock `startTime`/`endTime` in the tenant TZ.
 * Full ISO datetimes are unsafe near midnight: `now` + 30m can land on the next calendar day,
 * so end wall-clock is earlier than start on the same `date` → "End time must be greater than start time".
 *
 * Convert ISO values to HH:mm while preserving relative timing. When the window crosses a day:
 * - if end is still in the future, anchor to the end day (00:00 → end wall-clock) so in-progress
 *   booking tests stay open after UTC midnight
 * - otherwise clamp on the start day with end 23:59
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

  const startParts = parseTimeParts(startRaw)
  const endParts = parseTimeParts(endRaw)
  if (!startParts || !endParts) {
    return normalized as T
  }

  let startMins = startParts.minutes
  let endMins = endParts.minutes
  const crossedDay =
    Boolean(startParts.dayKey && endParts.dayKey && startParts.dayKey !== endParts.dayKey) ||
    endMins <= startMins

  let date =
    typeof normalized.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(normalized.date)
      ? normalized.date
      : startParts.dayKey || defaultTimeslotFields(2).date

  if (crossedDay) {
    const endAbs = endIsIso ? new Date(endRaw) : null
    const stillOpen =
      endAbs != null && !Number.isNaN(endAbs.getTime()) && endAbs.getTime() > Date.now()

    if (stillOpen && endParts.dayKey) {
      // In-progress across midnight: keep booking open until the real end wall-clock today.
      date = endParts.dayKey
      startMins = 0
      endMins = Math.max(endParts.minutes, 1)
    } else if (startMins >= 23 * 60 + 58) {
      startMins = 23 * 60
      endMins = 23 * 60 + 59
      if (startParts.dayKey) date = startParts.dayKey
    } else {
      endMins = 23 * 60 + 59
      if (startParts.dayKey) date = startParts.dayKey
    }
  }

  return {
    ...normalized,
    date,
    startTime: formatMins(startMins),
    endTime: formatMins(endMins),
  } as T
}
