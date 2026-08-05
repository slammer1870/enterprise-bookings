/** Only surface remaining capacity when it drops below this (sold out always shows). */
export const PLACES_REMAINING_DISPLAY_THRESHOLD = 10

/**
 * Label for course remaining enrollments.
 * Returns null when capacity is unknown or still plentiful (>= threshold).
 */
export function coursePlacesLabel(remaining: number | null): string | null {
  if (remaining == null) return null
  if (remaining <= 0) return 'Sold out'
  if (remaining >= PLACES_REMAINING_DISPLAY_THRESHOLD) return null
  if (remaining === 1) return '1 place left'
  return `${remaining} places left`
}
