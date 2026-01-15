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
      waitUntil: 'load',
      timeout: process.env.CI ? 120000 : 60000,
    })

    // Switch to a fresh user
    await page.goto('/admin/logout', { waitUntil: 'load' }).catch(() => {})
    await page.context().clearCookies()
    await page.waitForTimeout(1000)
    await waitForServerReady(page.context().request)

    // User: register
    const email = `user-${Date.now()}@example.com`
    const password = 'Password123!'
    await page.goto('/auth/sign-up', { waitUntil: 'load', timeout: process.env.CI ? 120000 : 60000 })

    // Better Auth UI can be flaky/hydration-sensitive in CI. Instead of driving the UI,
    // sign up + sign in via the Better Auth endpoints in the *browser context* so the
    // session cookies are properly set.
    await page.evaluate(
      async ({ email, password }) => {
        const signUpRes = await fetch('/api/auth/sign-up/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, name: 'Test User' }),
        })

        // Some setups might return 409 if a user exists; treat as ok for idempotency.
        if (!signUpRes.ok && signUpRes.status !== 409) {
          const txt = await signUpRes.text().catch(() => '')
          throw new Error(`signUp failed: ${signUpRes.status} ${txt}`)
        }

        const signInRes = await fetch('/api/auth/sign-in/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        })
        if (!signInRes.ok) {
          const txt = await signInRes.text().catch(() => '')
          throw new Error(`signIn failed: ${signInRes.status} ${txt}`)
        }
      },
      { email, password },
    )

    await page.goto('/dashboard', { waitUntil: 'load', timeout: process.env.CI ? 120000 : 60000 })
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {})
    await expect(page.locator('#schedule')).toBeVisible({ timeout: process.env.CI ? 120000 : 60000 })

    // Schedule: navigate to tomorrow and try to check in
    await goToTomorrowInSchedule(page)

    const checkInButton = page.getByRole('button', { name: /Check In|Book Trial Class/i }).first()
    await expect(checkInButton).toBeVisible({ timeout: process.env.CI ? 120000 : 60000 })
    
    // Ensure button is actionable before clicking
    await expect(checkInButton)
      .toBeEnabled({ timeout: 10000 })
      .catch(() => page.waitForTimeout(1000))
    
    // Set up navigation promise BEFORE clicking (critical for UI mode)
    const bookingPageNavPromise = page.waitForURL(new RegExp(`/bookings/${lessonId}`), {
      timeout: process.env.CI ? 120000 : 30000,
      waitUntil: 'load',
    })
    
    await Promise.all([
      checkInButton.click(),
      bookingPageNavPromise.catch(() => {}), // Don't fail if we stay on dashboard
    ])

    // If membership is required, we’ll be sent to /bookings/{lessonId}; otherwise we’ll remain on dashboard.
    // Wait a bit for navigation to complete after clicking
    await page.waitForTimeout(2000).catch(() => {})
    
    const reachedBookingPage = await page
      .waitForURL(new RegExp(`/bookings/${lessonId}`), { 
        timeout: process.env.CI ? 120000 : 30000,
        waitUntil: 'load',
      })
      .then(() => true)
      .catch(() => false)

    if (reachedBookingPage) {
      // Wait for page to fully load before looking for button
      await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {})
      
      const subscribeButton = page.getByRole('button', { name: /Subscribe|Upgrade/i }).first()
      await expect(subscribeButton).toBeVisible({ timeout: process.env.CI ? 120000 : 60000 })
      
      // Ensure button is actionable before clicking
      await expect(subscribeButton)
        .toBeEnabled({ timeout: 10000 })
        .catch(() => page.waitForTimeout(1000))
      
      // Set up navigation promise BEFORE clicking (critical for UI mode)
      const dashboardNavPromise = page.waitForURL(/\/dashboard/, { 
        timeout: process.env.CI ? 120000 : 60000,
        waitUntil: 'load',
      })
      
      await Promise.all([subscribeButton.click(), dashboardNavPromise])
    }

    // Confirm booking by triggering the test webhook
    await mockSubscriptionCreatedWebhook(page.context().request, { lessonId, userEmail: email })

    // Verify dashboard shows booking
    await page.goto('/dashboard', { waitUntil: 'load', timeout: process.env.CI ? 120000 : 60000 })
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {})
    await expect(page.locator('#schedule')).toBeVisible({ timeout: process.env.CI ? 120000 : 60000 })
    await goToTomorrowInSchedule(page)
    await expect(page.getByRole('button', { name: /Cancel Booking/i }).first()).toBeVisible({
      timeout: process.env.CI ? 120000 : 60000,
    })
  })
})



