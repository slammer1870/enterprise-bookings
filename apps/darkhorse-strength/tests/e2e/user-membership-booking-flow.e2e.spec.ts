import { test, expect } from '@playwright/test'
import {
  createClassOption,
  createLessonViaApi,
  ensureAdminLoggedIn,
  ensureAtLeastOneActivePlanWithStripePrice,
  goToTomorrowInSchedule,
  mockSubscriptionCreatedWebhook,
  saveObjectAndWaitForNavigation,
  setClassOptionAllowedPlans,
  uniqueClassName,
  waitForServerReady,
} from '@repo/testing-config/src/playwright'

test.describe('Darkhorse Strength: membership booking flow', () => {
  test.setTimeout(180000)

  test('user can register, subscribe, and booking is confirmed on dashboard', async ({ page }) => {
    // Admin: ensure plan + class option + lesson exist
    await ensureAdminLoggedIn(page)

    const { planId } = await ensureAtLeastOneActivePlanWithStripePrice(page)

    const className = uniqueClassName('E2E Class')
    await createClassOption(page, {
      name: className,
      description: 'A test class option for e2e (membership)',
    })
    await saveObjectAndWaitForNavigation(page, {
      apiPath: '/api/class-options',
      expectedUrlPattern: /\/admin\/collections\/class-options\/\d+/,
      collectionName: 'class-options',
    })
    const classOptionId = (() => {
      const m = page.url().match(/\/admin\/collections\/class-options\/(\d+)/)
      if (!m?.[1]) throw new Error(`Could not extract class-option id from URL: ${page.url()}`)
      return parseInt(m[1], 10)
    })()
    await setClassOptionAllowedPlans(page, { classOptionId, planIds: [planId] })

    // Create lesson via API to avoid admin date/time picker flakiness
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)

    const lessonId = await createLessonViaApi(page, {
      classOptionId,
      date: tomorrow,
      startHour: 10,
      startMinute: 0,
      endHour: 11,
      endMinute: 0,
    })

    // Optional: open the admin edit page for debugging parity with other flows
    await page.goto(`/admin/collections/lessons/${lessonId}`, {
      waitUntil: 'domcontentloaded',
      timeout: 120000,
    })

    // Switch to a fresh user
    await page.goto('/admin/logout', { waitUntil: 'domcontentloaded' }).catch(() => {})
    await page.context().clearCookies()
    await waitForServerReady(page.context().request)

    // User: register
    const email = `user-${Date.now()}@example.com`
    const password = 'Password123!'
    await page.goto('/register', { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.getByLabel(/Name/i).fill('Test User')
    await page.getByLabel(/Email/i).fill(email)
    await page.getByLabel(/^Password$/i).fill(password)
    await page.getByLabel(/Confirm Password/i).fill(password)
    await page.getByRole('button', { name: /Submit/i }).click()

    await page.waitForURL(/\/dashboard/, { timeout: 60000 })
    await expect(page.locator('#schedule')).toBeVisible({ timeout: 60000 })

    // Schedule: navigate to tomorrow and try to check in
    await goToTomorrowInSchedule(page)

    const checkInButton = page.getByRole('button', { name: /Check In|Book Trial Class/i }).first()
    await expect(checkInButton).toBeVisible({ timeout: 60000 })
    await checkInButton.click()

    // If membership is required, we’ll be sent to /bookings/{lessonId}; otherwise we’ll remain on dashboard.
    const reachedBookingPage = await page
      .waitForURL(new RegExp(`/bookings/${lessonId}`), { timeout: process.env.CI ? 60000 : 20000 })
      .then(() => true)
      .catch(() => false)

    if (reachedBookingPage) {
      const subscribeButton = page.getByRole('button', { name: /Subscribe|Upgrade/i }).first()
      await expect(subscribeButton).toBeVisible({ timeout: 60000 })
      await subscribeButton.click()
      // In e2e mode, checkout session endpoint returns /dashboard (no Stripe call)
      await page.waitForURL(/\/dashboard/, { timeout: 60000 })
    }

    // Confirm booking by triggering the test webhook
    await mockSubscriptionCreatedWebhook(page.context().request, { lessonId, userEmail: email })

    // Verify dashboard shows booking
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded', timeout: 60000 })
    await expect(page.locator('#schedule')).toBeVisible({ timeout: 60000 })
    await goToTomorrowInSchedule(page)
    await expect(page.getByRole('button', { name: /Cancel Booking/i }).first()).toBeVisible({
      timeout: 60000,
    })
  })
})



