import { test, expect } from '@playwright/test'
import {
  ensureAdminLoggedIn,
  mockSubscriptionCreatedWebhook,
  registerUserWithEmailPassword,
  waitForServerReady,
} from './helpers'
import { createClassOption, uniqueClassName } from '@repo/testing-config/src/playwright'
import { saveObjectAndWaitForNavigation } from '@repo/testing-config/src/playwright'

test.describe('User booking flow from schedule (kyuzo)', () => {
  test.setTimeout(180000)

  // TODO: This test is skipped due to a conflict between payload-auth/better-auth and the rolesPlugin.
  // When a user signs up via Better Auth UI, the "Role" field validation fails because the plugin
  // expects a specific role value that isn't being provided by Better Auth's sign-up flow.
  // Error: [payload-db-adapter] Error in creating: user [ValidationError: The following field is invalid: Role]
  // This needs investigation into how the betterAuthPluginOptions.users.roles interacts with rolesPlugin.
  test.skip('user can check in via register + subscription webhook confirms booking', async ({ page }) => {
    // Step 1: Admin creates a class option and lesson via API
    await ensureAdminLoggedIn(page)

    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStart = new Date(tomorrow)
    tomorrowStart.setHours(0, 0, 0, 0)

    const className = uniqueClassName('E2E Booking Test')
    await createClassOption(page, {
      name: className,
      description: 'A test class option for user booking e2e',
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

    // Create a lesson for tomorrow via API
    const desiredStart = new Date(tomorrowStart)
    desiredStart.setHours(10, 0, 0, 0)
    const desiredEnd = new Date(tomorrowStart)
    desiredEnd.setHours(11, 0, 0, 0)

    const createLessonRes = await page.context().request.post(`/api/lessons`, {
      data: {
        date: tomorrowStart.toISOString(),
        startTime: desiredStart.toISOString(),
        endTime: desiredEnd.toISOString(),
        lockOutTime: 0,
        classOption: classOptionId,
      },
    })

    if (!createLessonRes.ok()) {
      const txt = await createLessonRes.text().catch(() => '')
      throw new Error(`Failed to create lesson via API: ${createLessonRes.status()} ${txt}`)
    }

    const lessonJson: any = await createLessonRes.json().catch(() => null)
    const lessonId = lessonJson?.doc?.id ?? lessonJson?.id
    if (!lessonId) throw new Error(`Lesson created but no id returned: ${JSON.stringify(lessonJson)}`)

    // Step 2: Log out admin and clear cookies to simulate unauthenticated user
    await page.goto('/admin/logout', { waitUntil: 'load' }).catch(() => {})
    await page.context().clearCookies()
    await page.waitForTimeout(1000)
    await waitForServerReady(page.context().request)

    // Step 3: Navigate directly to /complete-booking (as unauthenticated user) with callbackUrl to booking
    const bookingUrl = `/bookings/${lessonId}`
    const completeBookingUrl = `/complete-booking?mode=login&callbackUrl=${encodeURIComponent(bookingUrl)}`
    await page.goto(completeBookingUrl, { waitUntil: 'load', timeout: 60000 })

    // Should be on /complete-booking
    await expect(page).toHaveURL(/\/complete-booking/)

    const callbackPath = bookingUrl

    const email = `user-${Date.now()}@example.com`
    const password = 'Password123!'

    // Register via better-auth-ui
    await registerUserWithEmailPassword(page, {
      name: 'John Doe',
      email,
      password,
      callbackPath,
    })

    // After auth, we should land back on booking callback or dashboard
    await page.waitForURL(
      (url) => url.pathname.startsWith(callbackPath) || url.pathname.startsWith('/dashboard'),
      { timeout: 60000 },
    )

    // If we landed on dashboard, go back to booking page to pick Membership
    try {
      const current = new URL(page.url())
      if (!current.pathname.startsWith(callbackPath)) {
        await page.goto(callbackPath, { waitUntil: 'domcontentloaded', timeout: 60000 })
      }
    } catch {
      await page.goto(callbackPath, { waitUntil: 'domcontentloaded', timeout: 60000 })
    }

    // On booking page, click Subscribe (membership checkout)
    const subscribeButton = page.getByRole('button', { name: /Subscribe|Upgrade/i }).first()
    await expect(subscribeButton).toBeVisible({ timeout: 60000 })

    // This mutation is via tRPC payments.createCustomerCheckoutSession; in test env it redirects to /dashboard
    await subscribeButton.click()
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 60000 })

    // Simulate Stripe subscription webhook confirming booking
    await mockSubscriptionCreatedWebhook(page.context().request, {
      lessonId: Number(lessonId),
      userEmail: email,
    })

    // Verify the booking was confirmed - user should see their booking on dashboard
    await page.goto('/dashboard', { waitUntil: 'load', timeout: 60000 })
    // The dashboard should show the user's bookings
    await expect(page.getByRole('button', { name: /View Booking|Cancel Booking/i }).first()).toBeVisible({
      timeout: 60000,
    })
  })
})



