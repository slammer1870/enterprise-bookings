import { describe, expect, it } from 'vitest'
import { buildCourseEnrollmentFromPurchase } from '@repo/bookings-payments'

describe('buildCourseEnrollmentFromPurchase (atnd-me)', () => {
  it('stamps fixed-window enrollment fields for webhook create', () => {
    const purchasedAt = new Date('2026-08-01T15:00:00.000Z')
    expect(
      buildCourseEnrollmentFromPurchase({
        userId: 9,
        courseId: 4,
        tenantId: 2,
        transactionId: 'pi_abc',
        purchasedAt,
        course: { startDate: '2026-09-01', endDate: '2026-10-26' },
      }),
    ).toMatchObject({
      user: 9,
      course: 4,
      tenant: 2,
      status: 'active',
      transactionId: 'pi_abc',
      accessStartsAt: '2026-09-01T00:00:00.000Z',
      accessEndsAt: '2026-10-26T23:59:59.999Z',
    })
  })
})
