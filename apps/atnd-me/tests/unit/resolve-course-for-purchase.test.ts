import { describe, expect, it } from 'vitest'
import {
  isCompleteGuestEmail,
  resolveCourseForPurchase,
} from '@/lib/courses/resolve-course-for-purchase'

const openCourse = {
  id: 4,
  status: 'open',
  tenant: 1,
  priceInformation: { price: 120 },
  maxEnrollments: 10,
}

describe('resolveCourseForPurchase', () => {
  it('accepts an open priced course under capacity', () => {
    expect(
      resolveCourseForPurchase({
        course: openCourse,
        expectedTenantId: 1,
        activeEnrollmentCount: 2,
      }),
    ).toEqual({
      ok: true,
      course: openCourse,
      priceCents: 12000,
      tenantId: 1,
    })
  })

  it('rejects missing course', () => {
    expect(
      resolveCourseForPurchase({
        course: null,
        expectedTenantId: 1,
        activeEnrollmentCount: 0,
      }),
    ).toEqual({ ok: false, status: 404, error: 'Course not found' })
  })

  it('rejects wrong tenant', () => {
    expect(
      resolveCourseForPurchase({
        course: openCourse,
        expectedTenantId: 99,
        activeEnrollmentCount: 0,
      }),
    ).toEqual({ ok: false, status: 404, error: 'Course not found' })
  })

  it('rejects non-open status', () => {
    expect(
      resolveCourseForPurchase({
        course: { ...openCourse, status: 'closed' },
        expectedTenantId: 1,
        activeEnrollmentCount: 0,
      }),
    ).toMatchObject({ ok: false, status: 400, error: expect.stringMatching(/not open/i) })
  })

  it('rejects a course whose start date has passed', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)

    expect(
      resolveCourseForPurchase({
        course: { ...openCourse, startDate: yesterday.toISOString().slice(0, 10) },
        expectedTenantId: 1,
        activeEnrollmentCount: 0,
      }),
    ).toMatchObject({ ok: false, status: 400, error: expect.stringMatching(/closed/i) })
  })

  it('rejects missing price', () => {
    expect(
      resolveCourseForPurchase({
        course: { ...openCourse, priceInformation: { price: 0 } },
        expectedTenantId: 1,
        activeEnrollmentCount: 0,
      }),
    ).toMatchObject({ ok: false, status: 400, error: expect.stringMatching(/no price/i) })
  })

  it('rejects sold out', () => {
    expect(
      resolveCourseForPurchase({
        course: openCourse,
        expectedTenantId: 1,
        activeEnrollmentCount: 10,
      }),
    ).toMatchObject({ ok: false, status: 400, error: expect.stringMatching(/sold out/i) })
  })
})

describe('isCompleteGuestEmail', () => {
  it('accepts complete emails only', () => {
    expect(isCompleteGuestEmail('sam@example.com')).toBe(true)
    expect(isCompleteGuestEmail('sam@ex')).toBe(false)
    expect(isCompleteGuestEmail('sam@')).toBe(false)
  })
})
