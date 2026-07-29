/**
 * Public copy for course access window (fixed dates vs duration from purchase).
 */

export type CourseAccessWindowCopyInput = {
  startDate?: string | null
  endDate?: string | null
  durationLength?: number | null
  durationUnit?: 'days' | 'weeks' | null
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

function formatDay(iso: string): string {
  const day = iso.trim().slice(0, 10)
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day)
  if (!match) return day
  const year = Number(match[1])
  const month = Number(match[2])
  const date = Number(match[3])
  if (!month || month < 1 || month > 12) return day
  return `${date} ${MONTHS[month - 1]} ${year}`
}

export function formatCourseAccessWindowCopy(
  course: CourseAccessWindowCopyInput,
): string | null {
  const start = typeof course.startDate === 'string' ? course.startDate.trim() : ''
  const end = typeof course.endDate === 'string' ? course.endDate.trim() : ''
  if (start && end) {
    return `${formatDay(start)} – ${formatDay(end)}`
  }

  const length =
    typeof course.durationLength === 'number' && course.durationLength >= 1
      ? Math.floor(course.durationLength)
      : null
  const unit = course.durationUnit === 'days' || course.durationUnit === 'weeks'
    ? course.durationUnit
    : null
  if (length != null && unit) {
    const label = length === 1 ? unit.slice(0, -1) : unit
    return `${length} ${label} from purchase`
  }

  return null
}
