/**
 * E2E: User with 0 confirmed but API-created pending bookings can access /bookings/[id]
 * without being redirected to home. With checkout holds enabled, those pending rows are
 * not auto-loaded into checkout; the user can still book via pay-at-door.
 */
import { test, expect } from './helpers/fixtures'
import { navigateToTenant } from './helpers/subdomain-helpers'
import { loginAsRegularUserViaApi } from './helpers/auth-helpers'
import {
  createTestEventType,
  createTestTimeslot,
  createTestBooking,
  getPayloadInstance,
} from './helpers/data-helpers'

test.describe('Two pending bookings: access booking route and make booking', () => {
  test('user with 0 confirmed and 2 pending can access /bookings/[id] and make a booking', async ({
    page,
    testData,
  }) => {
    const tenant = testData.tenants[0]!
    const user = testData.users.user1
    const workerIndex = testData.workerIndex

    const classOption = await createTestEventType(
      tenant.id,
      'Two Pending Access Test',
      10,
      undefined,
      workerIndex,
    )

    const startTime = new Date()
    startTime.setHours(10, 0, 0, 0)
    startTime.setDate(startTime.getDate() + 1 + workerIndex)
    const endTime = new Date(startTime)
    endTime.setHours(11, 0, 0, 0)

    const lesson = await createTestTimeslot(
      tenant.id,
      classOption.id,
      startTime,
      endTime,
      undefined,
      true,
    )

    await createTestBooking(user.id, lesson.id, 'pending')
    await createTestBooking(user.id, lesson.id, 'pending')

    await loginAsRegularUserViaApi(page, user.email, 'password', {
      tenantSlug: tenant.slug,
    })

    const tenantOrigin = `http://${tenant.slug}.localhost:3000`
    await expect
      .poll(
        async () => {
          const cookies = await page.context().cookies([tenantOrigin])
          return cookies.some((c) =>
            /^(better-auth\.|session_token|session_data|dont_remember)/.test(c.name),
          )
        },
        { timeout: 20_000 },
      )
      .toBe(true)

    await navigateToTenant(page, tenant.slug, `/bookings/${lesson.id}`)
    await page.waitForLoadState('load').catch(() => null)
    await page.waitForTimeout(2000)

    const currentUrl = page.url()

    expect(currentUrl).not.toMatch(/^https?:\/\/[^/]+\/?$/)
    expect(currentUrl).not.toContain('/?')
    expect(currentUrl).toContain('/bookings/')

    const isOnBookingPage = currentUrl.includes(`/bookings/${lesson.id}`)
    const isOnManagePage = currentUrl.includes(`/bookings/${lesson.id}/manage`)
    expect(isOnBookingPage || isOnManagePage).toBe(true)

    const errorHeading = page.getByRole('heading', {
      name: /booking page error|something went wrong/i,
    })
    await expect(errorHeading).not.toBeVisible({ timeout: 3000 })

    if (isOnManagePage) {
      await expect(page.getByText(/update booking quantity/i).first()).toBeVisible({
        timeout: 10_000,
      })
      await expect(page.getByTestId('booking-quantity')).toHaveText('2', { timeout: 10_000 })
      await expect(page.getByText(/complete payment/i)).not.toBeVisible()
    }

    const payload = await getPayloadInstance()
    const pendingRows = await payload.find({
      collection: 'bookings',
      where: {
        timeslot: { equals: lesson.id },
        user: { equals: user.id },
        status: { equals: 'pending' },
      },
      depth: 0,
      limit: 10,
      overrideAccess: true,
    })
    for (const row of pendingRows.docs ?? []) {
      await payload.update({
        collection: 'bookings',
        id: row.id,
        data: { status: 'cancelled' },
        overrideAccess: true,
      })
    }

    await navigateToTenant(page, tenant.slug, `/bookings/${lesson.id}`)

    await expect(
      page.getByText(/select quantity|number of slots|book|payment methods/i).first(),
    ).toBeVisible({ timeout: 15_000 })

    const bookBtn = page.getByRole('button', { name: /book \d+ slot/i })
    await expect(bookBtn).toBeVisible({ timeout: 12_000 })
    await bookBtn.click()
    await expect(page.getByRole('heading', { name: /thank you/i })).toBeVisible({ timeout: 15_000 })
  })
})
