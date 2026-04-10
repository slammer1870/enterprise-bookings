/**
 * E2E: custom admin dashboard (analytics) loads and /api/analytics returns real aggregates.
 */
import { test, expect } from './helpers/fixtures'
import { loginAsSuperAdmin, loginAsTenantAdmin } from './helpers/auth-helpers'
import {
  createTestEventType,
  createTestTimeslot,
  createTestBooking,
} from './helpers/data-helpers'

test.describe('Admin analytics dashboard', () => {
  test('super admin: analytics API returns 200 with counts after a confirmed booking in range', async ({
    page,
    testData,
    request,
  }) => {
    const tenantId = testData.tenants[0]?.id
    const w = testData.workerIndex
    if (!tenantId) throw new Error('Tenant required')

    const co = await createTestEventType(tenantId, 'E2E Analytics Dashboard', 10, undefined, w)
    const start = new Date()
    start.setDate(start.getDate() + 1)
    start.setHours(11, 0, 0, 0)
    const end = new Date(start)
    end.setHours(12, 0, 0, 0)
    const lesson = await createTestTimeslot(tenantId, co.id, start, end, undefined, true)
    await createTestBooking(testData.users.user1.id, lesson.id, 'confirmed')

    const analyticsResponse = page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/analytics') &&
        resp.request().method() === 'GET' &&
        resp.status() === 200,
      { timeout: 45_000 },
    )

    await loginAsSuperAdmin(page, testData.users.superAdmin.email, { request })

    const resp = await analyticsResponse
    expect(resp.status()).toBe(200)
    const body = (await resp.json()) as {
      summary: { totalBookings: number; uniqueCustomers: number }
      bookingsOverTime: unknown[]
      topCustomers: unknown[]
    }
    expect(body.summary.totalBookings).toBeGreaterThanOrEqual(1)
    expect(body.summary.uniqueCustomers).toBeGreaterThanOrEqual(1)
    expect(Array.isArray(body.bookingsOverTime)).toBe(true)
    expect(Array.isArray(body.topCustomers)).toBe(true)

    await expect(page.getByRole('heading', { name: /^analytics$/i })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Total bookings')).toBeVisible()
    await expect(page.getByText(/failed to load analytics|analytics failed/i)).toHaveCount(0)
  })

  test('tenant admin on tenant host: analytics loads without error', async ({
    page,
    testData,
    request,
  }) => {
    const slug = testData.tenants[0]?.slug
    if (!slug) throw new Error('Tenant slug required')

    const analyticsResponse = page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/analytics') &&
        resp.request().method() === 'GET' &&
        resp.status() === 200,
      { timeout: 45_000 },
    )

    await loginAsTenantAdmin(page, 1, testData.users.tenantAdmin1.email, {
      request,
      tenantSlug: slug,
    })

    const resp = await analyticsResponse
    expect(resp.status()).toBe(200)
    const body = (await resp.json()) as { summary: { totalBookings: number } }
    expect(typeof body.summary.totalBookings).toBe('number')

    await expect(page.getByRole('heading', { name: /^analytics$/i })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(/failed to load analytics|analytics failed/i)).toHaveCount(0)
  })
})
