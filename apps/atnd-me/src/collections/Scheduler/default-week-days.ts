/** One empty day row in the Mon–Sun scheduler template (index 0 = Monday). */
export type EmptySchedulerDay = { timeSlot: never[] }

/** Default week template: 7 empty day rows (Mon–Sun). */
export function defaultSchedulerWeekDays(): EmptySchedulerDay[] {
  return Array.from({ length: 7 }, () => ({ timeSlot: [] }))
}

/**
 * Ensure `week.days` has exactly 7 rows (pad with empty days, trim extras).
 * Preserves existing slots for days already present.
 */
export function ensureSevenSchedulerWeekDays(
  days: unknown,
): Array<{ timeSlot?: unknown[] | null; [key: string]: unknown }> {
  const existing = Array.isArray(days) ? [...days] : []
  while (existing.length < 7) {
    existing.push({ timeSlot: [] })
  }
  return existing.slice(0, 7) as Array<{ timeSlot?: unknown[] | null; [key: string]: unknown }>
}
