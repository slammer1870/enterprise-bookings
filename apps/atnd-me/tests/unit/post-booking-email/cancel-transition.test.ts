import { describe, expect, it } from 'vitest'
import { isCancelledTransition } from '@/lib/post-booking-email/cancel-scheduled-post-booking-email'

describe('isCancelledTransition', () => {
  it('returns true when status changes to cancelled', () => {
    expect(
      isCancelledTransition({
        doc: { status: 'cancelled' },
        previousDoc: { status: 'confirmed' },
      }),
    ).toBe(true)
  })

  it('returns false when booking was already cancelled', () => {
    expect(
      isCancelledTransition({
        doc: { status: 'cancelled' },
        previousDoc: { status: 'cancelled' },
      }),
    ).toBe(false)
  })

  it('returns false for non-cancelled updates', () => {
    expect(
      isCancelledTransition({
        doc: { status: 'confirmed' },
        previousDoc: { status: 'pending' },
      }),
    ).toBe(false)
  })
})
