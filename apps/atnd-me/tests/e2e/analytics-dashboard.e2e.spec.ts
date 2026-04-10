/**
 * E2E: custom admin dashboard (analytics) loads and /api/analytics returns real aggregates.
 */
import { test, expect } from './helpers/fixtures'
import { BASE_URL, loginAsSuperAdmin, loginAsTenantAdmin } from './helpers/auth-helpers'
import {
  createTestEventType,
  createTestTimeslot,
  createTestBooking,
  getPayloadInstance,
} from './helpers/data-helpers'
import {
  getCalendarDatesWithTimeslotsInRangeE2E,
  countConfirmedBookingsForResolvedTimeslotsE2E,
} from './helpers/analytics-timeslot-helpers'

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

  test('bookings over time: chart days match timeslots in range (no bookings on days without slots)', async ({
    page,
    testData,
    request,
  }) => {
    const tenantId = testData.tenants[0]?.id
    const w = testData.workerIndex
    if (!tenantId) throw new Error('Tenant required')

    /**
     * Wide end date so timeslots whose `startTime` is rewritten in tenant timezone (timeslot
     * `beforeChange`) still fall inside analytics’ padded `startTime` window (dateTo + 1 day).
     */
    const dateFrom = '2030-06-01'
    const dateTo = '2030-06-30'

    const co = await createTestEventType(tenantId, 'E2E Analytics Trend Gap Days', 10, undefined, w)

    const mkSlot = (ymd: string, h: number) => {
      const start = new Date(`${ymd}T${String(h).padStart(2, '0')}:00:00.000Z`)
      const end = new Date(start)
      end.setUTCHours(end.getUTCHours() + 1)
      return createTestTimeslot(tenantId, co.id, start, end, undefined, true)
    }

    // Mid-month UTC dates avoid edge cases where timeslot `beforeChange` + tenant TZ shifts `startTime`/`date` near month boundaries.
    const slotD18a = await mkSlot('2030-06-18', 10)
    const slotD18b = await mkSlot('2030-06-18', 14)
    const slotD20a = await mkSlot('2030-06-20', 10)
    const slotD20b = await mkSlot('2030-06-20', 15)

    const ourSlotIds = [slotD18a.id, slotD18b.id, slotD20a.id, slotD20b.id]

    await createTestBooking(testData.users.user1.id, slotD18a.id, 'confirmed')
    await createTestBooking(testData.users.user1.id, slotD18b.id, 'confirmed')
    await createTestBooking(testData.users.user1.id, slotD20a.id, 'confirmed')
    await createTestBooking(testData.users.user1.id, slotD20b.id, 'confirmed')

    const payload = await getPayloadInstance()
    const rangeParams = { dateFrom, dateTo, tenantId }
    const fixtureBookings = await payload.find({
      collection: 'bookings',
      where: {
        and: [
          { tenant: { equals: tenantId } },
          { status: { equals: 'confirmed' } },
          { timeslot: { in: ourSlotIds } },
        ],
      },
      limit: 20,
      depth: 0,
      overrideAccess: true,
    })
    expect(fixtureBookings.totalDocs, 'all four test bookings should persist as confirmed').toBe(4)

    const datesWithSlots = await getCalendarDatesWithTimeslotsInRangeE2E(payload, rangeParams)
    const expectedBookingTotal = await countConfirmedBookingsForResolvedTimeslotsE2E(payload, rangeParams)
    expect(expectedBookingTotal).toBe(fixtureBookings.totalDocs)

    await loginAsSuperAdmin(page, testData.users.superAdmin.email, { request })

    const qs = new URLSearchParams({
      dateFrom,
      dateTo,
      tenantId: String(tenantId),
      granularity: 'day',
    })
    const apiRes = await page.request.get(`${BASE_URL}/api/analytics?${qs.toString()}`)
    expect(apiRes.ok(), await apiRes.text()).toBeTruthy()

    const body = (await apiRes.json()) as {
      bookingsOverTime: { date: string; count: number }[]
      summary: { totalBookings: number }
    }

    expect(body.summary.totalBookings).toBe(expectedBookingTotal)

    const byDay = new Map<string, number>()
    for (const row of body.bookingsOverTime) {
      const key = row.date.slice(0, 10)
      byDay.set(key, (byDay.get(key) ?? 0) + row.count)
    }

    let chartSum = 0
    for (const row of body.bookingsOverTime) chartSum += row.count
    expect(chartSum).toBe(expectedBookingTotal)

    for (const row of body.bookingsOverTime) {
      const day = row.date.slice(0, 10)
      if (row.count > 0) {
        expect(
          datesWithSlots.has(day),
          `non-zero chart counts must map to a calendar day that has timeslots in range (${day})`,
        ).toBe(true)
      }
    }

    // 2030-06-19 has no fixture timeslots (gap between 18 and 20); dense series must still be zero there.
    for (const d of ['2030-06-19']) {
      if (!datesWithSlots.has(d)) {
        expect(byDay.get(d) ?? 0, `no chart bookings on ${d} when there are no timeslots that day`).toBe(0)
      }
    }
  })
})
