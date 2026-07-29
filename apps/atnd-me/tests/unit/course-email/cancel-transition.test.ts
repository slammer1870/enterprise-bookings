import { describe, expect, it } from 'vitest'
import { isCancelledEnrollmentTransition } from '@/lib/course-email/cancel-transition'

describe('isCancelledEnrollmentTransition', () => {
  it('returns true when status changes to cancelled', () => {
    expect(
      isCancelledEnrollmentTransition({
        doc: { status: 'cancelled' },
        previousDoc: { status: 'active' },
        operation: 'update',
      }),
    ).toBe(true)
  })

  it('returns false when enrollment was already cancelled', () => {
    expect(
      isCancelledEnrollmentTransition({
        doc: { status: 'cancelled' },
        previousDoc: { status: 'cancelled' },
        operation: 'update',
      }),
    ).toBe(false)
  })

  it('returns false for non-cancelled updates', () => {
    expect(
      isCancelledEnrollmentTransition({
        doc: { status: 'completed' },
        previousDoc: { status: 'active' },
        operation: 'update',
      }),
    ).toBe(false)
  })
})
