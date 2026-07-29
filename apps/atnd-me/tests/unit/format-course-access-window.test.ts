import { describe, expect, it } from 'vitest'
import { formatCourseAccessWindowCopy } from '@/lib/courses/format-course-access-window'

describe('formatCourseAccessWindowCopy', () => {
  it('formats fixed dates', () => {
    expect(
      formatCourseAccessWindowCopy({
        startDate: '2026-09-01',
        endDate: '2026-10-26',
      }),
    ).toBe('1 Sep 2026 – 26 Oct 2026')
  })

  it('formats duration weeks from purchase', () => {
    expect(
      formatCourseAccessWindowCopy({
        durationLength: 8,
        durationUnit: 'weeks',
      }),
    ).toBe('8 weeks from purchase')
  })

  it('formats singular day duration', () => {
    expect(
      formatCourseAccessWindowCopy({
        durationLength: 1,
        durationUnit: 'days',
      }),
    ).toBe('1 day from purchase')
  })

  it('returns null when incomplete', () => {
    expect(formatCourseAccessWindowCopy({})).toBeNull()
  })
})
