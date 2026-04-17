/**
 * Regular user: book a pay-at-door slot via the booking UI, then cancel the confirmed
 * booking from the manage page (per-booking Cancel + confirm dialog).
 */
import { test, expect } from './helpers/fixtures'
import { loginAsRegularUser } from './helpers/auth-helpers'
import { navigateToTenant } from './helpers/subdomain-helpers'
import {
  createTestEventType,
  createTestTimeslot,
  getPayloadInstance,
} from './helpers/data-helpers'

test.describe('User pay-at-door book and cancel', () => {
  test.setTimeout(120_000)

  test('regular user can book pay-at-door in UI then cancel on manage page', async ({
    page,
    testData,
  }) => {
    const tenantId = testData.tenants[0]?.id
    const tenantSlug = testData.tenants[0]?.slug
    const w = testData.workerIndex
    const user = testData.users.user1

    if (!tenantId || !tenantSlug) throw new Error('Tenant required')

    const co = await createTestEventType(
      tenantId,
      `E2E Pay at Door Book Cancel w${w}`,
      5,
      undefined,
      w,
    )

    const start = new Date()
    start.setDate(start.getDate() + 2)
    start.setHours(12, 0, 0, 0)
    const end = new Date(start)
    end.setHours(13, 0, 0, 0)
    const lesson = await createTestTimeslot(tenantId, co.id, start, end, undefined, true)

    await loginAsRegularUser(page, 1, user.email, 'password', { tenantSlug })
    await navigateToTenant(page, tenantSlug, `/bookings/${lesson.id}`)
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => null)

    await expect(page.getByText(/select quantity/i).first()).toBeVisible({ timeout: 10_000 })
    const bookBtn = page.getByRole('button', { name: /^book\b/i }).first()
    await expect(bookBtn).toBeVisible()
    await expect(bookBtn).toBeEnabled()

    const incQtyBtn = page.getByRole('button', { name: /increase quantity/i }).first()
    const decQtyBtn = page.getByRole('button', { name: /decrease quantity/i }).first()
    await incQtyBtn.click()
    await expect(bookBtn).toHaveText(/book\s+2\s+slot/i, { timeout: 10_000 })
    await decQtyBtn.click()
    await expect(bookBtn).toHaveText(/book\b/i, { timeout: 10_000 })

    const createBookingsRequest = page.waitForRequest(
      (request) => {
        if (request.method() !== 'POST') return false
        const url = request.url()
        if (!url.includes('/api/trpc')) return false
        if (url.includes('bookings.createBookings')) return true
        const body = request.postData() ?? ''
        return body.includes('bookings.createBookings')
      },
      { timeout: 15_000 },
    )

    await Promise.all([createBookingsRequest, bookBtn.click()])

    await expect(page.getByRole('heading', { name: /thank you/i })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByText(/your booking has been confirmed/i)).toBeVisible()

    await navigateToTenant(page, tenantSlug, `/bookings/${lesson.id}/manage`)
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => null)

    // CardTitle renders as a div — match copy, not heading role.
    await expect(page.getByText(/update booking quantity/i).first()).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByText(/your bookings/i).first()).toBeVisible({ timeout: 10_000 })

    const rowCancel = page
      .locator('div.flex.items-center.justify-between.p-4.border.rounded-lg')
      .filter({ hasText: /Booking #/ })
      .getByRole('button', { name: /^cancel$/i })

    await expect(rowCancel).toBeVisible({ timeout: 10_000 })
    await rowCancel.click()

    await expect(
      page.getByRole('heading', { name: /are you sure you want to cancel this booking/i }),
    ).toBeVisible({ timeout: 5000 })

    const cancelBookingRequest = page.waitForRequest(
      (request) => {
        if (request.method() !== 'POST') return false
        const url = request.url()
        if (!url.includes('/api/trpc')) return false
        if (url.includes('bookings.cancelBooking')) return true
        const body = request.postData() ?? ''
        return body.includes('bookings.cancelBooking')
      },
      { timeout: 15_000 },
    )
    await Promise.all([cancelBookingRequest, page.getByRole('button', { name: /^confirm$/i }).click()])

    await expect(page.getByText(/you have no bookings for this timeslot/i)).toBeVisible({
      timeout: 15_000,
    })

    const payload = await getPayloadInstance()
    const bookings = await payload.find({
      collection: 'bookings',
      where: {
        and: [{ timeslot: { equals: lesson.id } }, { user: { equals: user.id } }],
      },
      depth: 0,
      limit: 50,
      overrideAccess: true,
    })
    const active = (bookings?.docs ?? []).filter(
      (b: { status?: string }) => String(b?.status ?? '').toLowerCase() !== 'cancelled',
    )
    expect(active.length).toBe(0)
  })
})
