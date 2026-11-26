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
 * Convert ISO values to HH:mm while preserving relative timing. Only clamp when the window
 * would otherwise invert on a single calendar day (do not rewrite every slot to 10:00–11:00).
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

  if (crossedDay) {
    // Keep start; extend end to end-of-day so in-progress fixtures stay open when possible.
    if (startMins >= 23 * 60 + 58) {
      startMins = 23 * 60
      endMins = 23 * 60 + 59
    } else {
      endMins = 23 * 60 + 59
    }
  }

  const date =
    typeof normalized.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(normalized.date)
      ? normalized.date
      : startParts.dayKey || defaultTimeslotFields(2).date

  return {
    ...normalized,
    date,
    startTime: formatMins(startMins),
    endTime: formatMins(endMins),
  } as T
}
