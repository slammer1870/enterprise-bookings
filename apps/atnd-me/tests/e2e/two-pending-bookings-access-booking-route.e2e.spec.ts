/**
 * E2E: User with 0 confirmed but 2 pending bookings can access /bookings/[id]
 * and complete a booking without being redirected to home (regression test for
 * the bug where such users hit an error and got redirected to /).
 */
import { test, expect } from './helpers/fixtures'
import { navigateToTenant } from './helpers/subdomain-helpers'
import { loginAsRegularUserViaApi } from './helpers/auth-helpers'
import {
  createTestEventType,
  createTestTimeslot,
  createTestBooking,
} from './helpers/data-helpers'

test.describe('Two pending bookings: access booking route and make booking', () => {
  test('user with 0 confirmed and 2 pending can access /bookings/[id] and make a booking', async ({
    page,
    testData,
  }) => {
    const tenant = testData.tenants[0]!
    const user = testData.users.user1
    const workerIndex = testData.workerIndex

    // Create pay-at-door lesson (no payment methods) so booking creates confirmed directly
    const classOption = await createTestEventType(
      tenant.id,
      'Two Pending Access Test',
      10,
      undefined,
      workerIndex
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
      true
    )

    // Create 2 pending bookings (0 confirmed) - simulates abandoned checkout
    await createTestBooking(user.id, lesson.id, 'pending')
    await createTestBooking(user.id, lesson.id, 'pending')

    // Use API login to avoid flaky UI login / rate limiting in CI.
    await loginAsRegularUserViaApi(page, user.email, 'password', {
      tenantSlug: tenant.slug,
    })

    // Ensure session cookies exist on tenant host before hitting protected routes.
    const tenantOrigin = `http://${tenant.slug}.localhost:3000`
    await expect
      .poll(
        async () => {
          const cookies = await page.context().cookies([tenantOrigin])
          return cookies.some((c) => /^(better-auth\.|session_token|session_data|dont_remember)/.test(c.name))
        },
        { timeout: 20_000 },
      )
      .toBe(true)

    // Navigate to booking page - should NOT redirect to home (the regression we're testing)
    await navigateToTenant(page, tenant.slug, `/bookings/${lesson.id}`)
    await page.waitForLoadState('load').catch(() => null)

    // Allow time for any server-side redirect (e.g. postValidation -> /manage)
    await page.waitForTimeout(2000)

    const currentUrl = page.url()

    // CRITICAL: Must NOT be redirected to home (root)
    expect(currentUrl).not.toMatch(/^https?:\/\/[^/]+\/?$/)
    expect(currentUrl).not.toContain('/?')
    expect(currentUrl).toContain('/bookings/')

    // We should either be on /bookings/[id] or /bookings/[id]/manage (postValidation redirect)
    const isOnBookingPage = currentUrl.includes(`/bookings/${lesson.id}`)
    const isOnManagePage = currentUrl.includes(`/bookings/${lesson.id}/manage`)

    expect(isOnBookingPage || isOnManagePage).toBe(true)

    // Page should show booking-related content (not error boundary or generic home)
    const errorHeading = page.getByRole('heading', { name: /booking page error|something went wrong/i })
    await expect(errorHeading).not.toBeVisible({ timeout: 3000 })

    if (isOnManagePage) {
      // On manage with 2 pending: verify we see manage/checkout content
      await expect(
        page.getByText(/update booking quantity|complete payment|pending booking|booking/i).first()
      ).toBeVisible({ timeout: 10000 })

      // "Make a booking": Cancel the 2 pending, then book fresh (pay-at-door = confirmed)
      // Payment flow has a Cancel button; after cancelling we see "Book Now"
      const cancelButton = page.getByRole('button', { name: /^cancel$/i }).first()
      if (await cancelButton.isVisible().catch(() => false)) {
        await cancelButton.click()
        await page.waitForTimeout(2000)

        // After cancelling, we see "You have no bookings" and "Book Now"
        const bookNowButton = page.getByRole('button', { name: /book now/i })
        await expect(bookNowButton).toBeVisible({ timeout: 10000 })
        await bookNowButton.click()
      } else {
        // Fallback: quantity control to decrease to 0
        const quantityDisplay = page.getByTestId('booking-quantity').or(page.getByTestId('pending-booking-quantity'))
        const decreaseButton = page.getByLabel(/decrease/i).first()
        await expect(quantityDisplay).toBeVisible({ timeout: 5000 })
        await decreaseButton.click()
        await page.waitForTimeout(500)
        await decreaseButton.click()
        await page.getByRole('button', { name: /update quantity|update bookings/i }).click()
        await page.waitForTimeout(2000)
        await navigateToTenant(page, tenant.slug, `/bookings/${lesson.id}`)
      }

      // Now on booking page: make a fresh booking (pay-at-door = confirmed directly)
      await expect(
        page.getByText(/select quantity|number of slots|book|payment methods/i).first()
      ).toBeVisible({ timeout: 12000 })
      const bookBtn = page.getByRole('button', { name: /book/i }).first()
      await expect(bookBtn).toBeVisible({ timeout: 10000 })
      await bookBtn.click()

      await expect(page.getByRole('heading', { name: /thank you/i })).toBeVisible({ timeout: 15000 })
    } else {
      // Stayed on booking page: wait for form (quantity, Book, or payment methods label) then make a booking
      await expect(
        page.getByText(/select quantity|number of slots|book|payment methods/i).first()
      ).toBeVisible({ timeout: 15000 })
      const bookBtn = page.getByRole('button', { name: /book/i }).first()
      await expect(bookBtn).toBeVisible({ timeout: 12000 })
      await bookBtn.click()
      await expect(page.getByRole('heading', { name: /thank you/i })).toBeVisible({ timeout: 15000 })
    }
  })
})
