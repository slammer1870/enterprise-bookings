import { describe, expect, it, vi } from 'vitest'
import { assignCourseEnrollmentFromPurchase } from '@/lib/stripe-connect/webhook/assign-course-enrollment-from-purchase'

function mockPayload(overrides: Record<string, unknown> = {}) {
  return {
    logger: { error: vi.fn() },
    find: vi.fn().mockResolvedValue({ docs: [], totalDocs: 0 }),
    findByID: vi.fn().mockResolvedValue({
      status: 'open',
      startDate: '2026-09-01',
      endDate: '2026-10-26',
    }),
    create: vi.fn().mockResolvedValue({ id: 55 }),
    ...overrides,
  } as any
}

describe('assignCourseEnrollmentFromPurchase', () => {
  it('skips non-course purchases', async () => {
    const payload = mockPayload()
    const result = await assignCourseEnrollmentFromPurchase({
      payload,
      tenantId: 1,
      metadata: { type: 'class_pass_purchase' },
      transactionId: 'pi_1',
    })
    expect(result).toEqual({ assigned: false, reason: 'not_course_purchase' })
  })

  it('is idempotent when enrollment already exists for transaction', async () => {
    const payload = mockPayload({
      find: vi.fn().mockResolvedValue({ docs: [{ id: 12 }], totalDocs: 1 }),
    })
    const result = await assignCourseEnrollmentFromPurchase({
      payload,
      tenantId: 1,
      metadata: { type: 'course_purchase', userId: '3', courseId: '4' },
      transactionId: 'pi_1',
    })
    expect(result).toEqual({ assigned: true, enrollmentId: 12 })
    expect(payload.create).not.toHaveBeenCalled()
  })

  it('creates enrollment with stamped access window', async () => {
    const payload = mockPayload()
    const purchasedAt = new Date('2026-08-01T15:00:00.000Z')
    const result = await assignCourseEnrollmentFromPurchase({
      payload,
      tenantId: 1,
      metadata: { type: 'course_purchase', userId: '3', courseId: '4' },
      transactionId: 'pi_1',
      purchasedAt,
    })
    expect(result).toEqual({ assigned: true, enrollmentId: 55 })
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'course-enrollments',
        data: expect.objectContaining({
          user: 3,
          course: 4,
          tenant: 1,
          status: 'active',
          transactionId: 'pi_1',
          accessStartsAt: '2026-09-01T00:00:00.000Z',
          accessEndsAt: '2026-10-26T23:59:59.999Z',
        }),
      }),
    )
  })

  it('rejects sold out courses', async () => {
    const payload = mockPayload({
      findByID: vi.fn().mockResolvedValue({
        status: 'open',
        startDate: '2026-09-01',
        endDate: '2026-10-26',
        maxEnrollments: 1,
      }),
      find: vi
        .fn()
        .mockResolvedValueOnce({ docs: [], totalDocs: 0 }) // idempotency lookup
        .mockResolvedValueOnce({ docs: [], totalDocs: 1 }), // active count
    })
    const result = await assignCourseEnrollmentFromPurchase({
      payload,
      tenantId: 1,
      metadata: { type: 'course_purchase', userId: '3', courseId: '4' },
      transactionId: 'pi_1',
    })
    expect(result).toEqual({ assigned: false, reason: 'sold_out' })
  })
})
