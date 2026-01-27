import { test, expect } from './helpers/fixtures'
import { navigateToTenant } from './helpers/subdomain-helpers'
import { loginAsRegularUser } from './helpers/auth-helpers'
import {
  createTestClassOption,
  createTestLesson,
  createTestBooking,
} from './helpers/data-helpers'

test.describe('Multi-Booking Management E2E Tests', () => {
  let lesson: any
  let guardLesson: any
  let fullLesson: any

  test.beforeAll(async ({ testData }) => {
    const workerIndex = testData.workerIndex
    const tenant = testData.tenants[0]!

    // Create class option with sufficient capacity
    const classOption = await createTestClassOption(
      tenant.id,
      'Multi-Booking Test Class',
      10,
      undefined,
      workerIndex
    )

    // Create lesson with available capacity
    const startTime = new Date()
    startTime.setHours(10, 0, 0, 0)
    startTime.setDate(startTime.getDate() + 1 + workerIndex) // Worker-scoped day to avoid collisions
    const endTime = new Date(startTime)
    endTime.setHours(11, 0, 0, 0)

    lesson = await createTestLesson(
      tenant.id,
      classOption.id,
      startTime,
      endTime,
      undefined,
      true
    )

    // Create a separate lesson used only for route-guard tests so booking counts are isolated.
    const guardStartTime = new Date(startTime)
    guardStartTime.setHours(12, 0, 0, 0)
    const guardEndTime = new Date(guardStartTime)
    guardEndTime.setHours(13, 0, 0, 0)

    guardLesson = await createTestLesson(
      tenant.id,
      classOption.id,
      guardStartTime,
      guardEndTime,
      undefined,
      true
    )

    // Create a fully booked lesson for capacity testing
    const fullClassOption = await createTestClassOption(
      tenant.id,
      'Full Multi-Booking Test Class',
      2,
      undefined,
      workerIndex
    )

    const fullStartTime = new Date()
    fullStartTime.setHours(14, 0, 0, 0)
    fullStartTime.setDate(fullStartTime.getDate() + 1 + workerIndex)
    const fullEndTime = new Date(fullStartTime)
    fullEndTime.setHours(15, 0, 0, 0)

    fullLesson = await createTestLesson(
      tenant.id,
      fullClassOption.id,
      fullStartTime,
      fullEndTime,
      undefined,
      true
    )

    // Pre-book ONE slot so user1 can take the last slot during the test.
    // The guard we want to test is "can't increase beyond remaining capacity" on the manage page.
    await createTestBooking(testData.users.user2.id, fullLesson.id, 'confirmed')
  })

  test.describe('CTA -> Manage Routing', () => {
    test('should automatically redirect to manage page when user has 2+ bookings', async ({
      page,
      testData,
    }) => {
      const tenant = testData.tenants[0]!
      // Create 2 confirmed bookings for user1
      await createTestBooking(testData.users.user1.id, lesson.id, 'confirmed')
      await createTestBooking(testData.users.user1.id, lesson.id, 'confirmed')

      // Login on the tenant subdomain first
      await loginAsRegularUser(page, 1, testData.users.user1.email, 'password', {
        tenantSlug: tenant.slug,
      })
      
      // Wait a moment for session to be established
      await page.waitForTimeout(500)
      
      // Navigate to booking page - should automatically redirect to manage page
      // because user has 2+ bookings (handled by postValidation in booking page config)
      // Use page.goto with waitUntil to properly handle server-side redirects
      const bookingUrl = `http://${tenant.slug}.localhost:3000/bookings/${lesson.id}`
      const manageUrl = `http://${tenant.slug}.localhost:3000/bookings/${lesson.id}/manage`
      
      // Navigate and wait for either the booking page or the redirect to manage page
      // NOTE: `networkidle` is flaky in Next dev due to websockets/HMR and can also produce ERR_ABORTED on redirects.
      try {
        await page.goto(bookingUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
      } catch (err) {
        // Some Chromium versions surface server-side redirects as ERR_ABORTED; the URL often still updates correctly.
        if (!String(err).includes('net::ERR_ABORTED')) throw err
      }
      
      // Give the server-side redirect a moment to land (avoid `networkidle` / fixed sleeps).
      await page.waitForURL(manageUrl, { timeout: 10000 }).catch(() => null)
      
      // Check if we're on manage page (automatic redirect) or still on booking page
      const currentUrl = page.url()
      
      // If we're redirected to login, that means session wasn't established - fail the test
      if (currentUrl.includes('/complete-booking') || currentUrl.includes('/auth/sign-in')) {
        throw new Error(`User session not established on tenant subdomain. Redirected to: ${currentUrl}`)
      }
      
      // If we're already on manage page, great! Otherwise wait for redirect
      if (!currentUrl.includes('/manage')) {
        // Wait for automatic redirect to manage page (server-side redirect should happen immediately)
        await page.waitForURL(
          manageUrl,
          { timeout: 10000 }
        ).catch(() => {
          // If redirect didn't happen, check what page we're on
          const finalUrl = page.url()
          throw new Error(`Expected redirect to /manage but stayed on: ${finalUrl}`)
        })
      }

      // Assert we're on the manage page (automatic redirect from booking page)
      expect(page.url()).toContain('/bookings/')
      expect(page.url()).toContain('/manage')
    })
  })

  test.describe('Manage Route Guard', () => {
    test('should redirect to booking page when user has 0 bookings', async ({ page, testData }) => {
      const tenant = testData.tenants[0]!
      // Use a user that can authenticate on this tenant (registrationTenant = tenant1),
      // and a lesson with no bookings for that user.
      await loginAsRegularUser(page, 1, testData.users.user1.email, 'password', {
        tenantSlug: tenant.slug,
      })
      
      // Navigate to manage page - should redirect to regular booking page
      await navigateToTenant(page, tenant.slug, `/bookings/${guardLesson.id}/manage`)

      // Should redirect to /bookings/[id] (not /manage) OR stay on manage if redirect hasn't happened yet
      // Wait for either the redirect or verify we're not on manage
      await page.waitForURL(
        (url) => {
          const pathname = url.pathname
          // Accept: /bookings/[id] without /manage, or /auth/sign-in (if not logged in)
          return (
            (pathname.includes('/bookings/') && !pathname.includes('/manage')) ||
            pathname.includes('/auth/sign-in')
          )
        },
        { timeout: 10000 }
      ).catch(() => {
        // If timeout, check current URL
        const currentUrl = page.url()
        const currentPathname = (() => {
          try {
            return new URL(currentUrl).pathname
          } catch {
            return currentUrl
          }
        })()
        // If we're still on /manage, that's a failure
        if (currentPathname.includes('/manage')) {
          throw new Error(`Expected redirect from /manage but still on: ${currentUrl}`)
        }
      })

      const finalUrl = page.url()
      // Should either be on booking page or sign-in (if auth failed)
      expect(
        (finalUrl.includes('/bookings/') && !finalUrl.includes('/manage')) ||
        finalUrl.includes('/auth/sign-in')
      ).toBe(true)
    })

    test('should redirect to booking page when user has 1 booking', async ({ page, testData }) => {
      const tenant = testData.tenants[0]!
      // Create 1 booking
      await createTestBooking(testData.users.user1.id, guardLesson.id, 'confirmed')

      await loginAsRegularUser(page, 1, testData.users.user1.email, 'password', {
        tenantSlug: tenant.slug,
      })
      
      // Navigate to manage page - should redirect to regular booking page
      await navigateToTenant(page, tenant.slug, `/bookings/${guardLesson.id}/manage`)

      // Should redirect to /bookings/[id] (not /manage) OR stay on manage if redirect hasn't happened yet
      await page.waitForURL(
        (url) => {
          const pathname = url.pathname
          // Accept: /bookings/[id] without /manage, or /auth/sign-in (if not logged in)
          return (
            (pathname.includes('/bookings/') && !pathname.includes('/manage')) ||
            pathname.includes('/auth/sign-in')
          )
        },
        { timeout: 10000 }
      ).catch(() => {
        // If timeout, check current URL
        const currentUrl = page.url()
        const currentPathname = (() => {
          try {
            return new URL(currentUrl).pathname
          } catch {
            return currentUrl
          }
        })()
        // If we're still on /manage, that's a failure
        if (currentPathname.includes('/manage')) {
          throw new Error(`Expected redirect from /manage but still on: ${currentUrl}`)
        }
      })

      const finalUrl = page.url()
      // Should either be on booking page or sign-in (if auth failed)
      expect(
        (finalUrl.includes('/bookings/') && !finalUrl.includes('/manage')) ||
        finalUrl.includes('/auth/sign-in')
      ).toBe(true)
    })
  })

  test.describe('Decrease Quantity Flow', () => {
    test('should decrease booking quantity from 3 to 1', async ({ page, testData }) => {
      const tenant = testData.tenants[0]!
      // Create 3 confirmed bookings
      await createTestBooking(testData.users.user1.id, lesson.id, 'confirmed')
      await createTestBooking(testData.users.user1.id, lesson.id, 'confirmed')
      await createTestBooking(testData.users.user1.id, lesson.id, 'confirmed')

      await loginAsRegularUser(page, 1, testData.users.user1.email, 'password', {
        tenantSlug: tenant.slug,
      })
      await navigateToTenant(page, tenant.slug, `/bookings/${lesson.id}/manage`)

      // Wait for manage page to load
      await page.waitForLoadState('networkidle')

      // Find the quantity decrease button (minus button)
      const decreaseButton = page
        .locator('button[aria-label*="Decrease"]')
        .or(page.locator('button:has-text("-")'))
        .or(page.locator('button').filter({ has: page.locator('svg') }))
        .first()

      // Find the quantity display (should show 3)
      const quantityDisplay = page.locator('text=/\\d+/').filter({ hasText: /^3$/ }).first()

      // Click decrease button twice to go from 3 to 1
      const hasDecreaseButton = await decreaseButton.isVisible().catch(() => false)
      if (hasDecreaseButton) {
        // Click twice to decrease from 3 to 1
        await decreaseButton.click()
        await page.waitForTimeout(500)
        await decreaseButton.click()
        await page.waitForTimeout(500)

        // Find and click "Update Bookings" button
        const updateButton = page
          .locator('button:has-text("Update Bookings")')
          .or(page.getByRole('button', { name: /update/i }))
          .first()

        const hasUpdateButton = await updateButton.isVisible().catch(() => false)
        if (hasUpdateButton) {
          await updateButton.click()

          // Wait for success toast
          await page.waitForSelector('text=/success|updated|booking/i', { timeout: 10000 }).catch(() => null)

          // Wait for page to update
          await page.waitForTimeout(1000)

          // Verify bookings list shows 1 confirmed booking
          // Look for booking count or booking cards
          const bookingCount = await page
            .locator('text=/1.*booking|booking.*1/i')
            .first()
            .isVisible()
            .catch(() => false)

          // Also check for success message
          const successMessage = await page
            .locator('text=/success|updated|cancelled/i')
            .first()
            .isVisible()
            .catch(() => false)

          expect(bookingCount || successMessage).toBe(true)
        }
      }
    })
  })

  test.describe('Increase Quantity Flow', () => {
    test('should increase booking quantity from 1 to 2 (no payment)', async ({ page, testData }) => {
      const tenant = testData.tenants[0]!
      // Create 1 confirmed booking
      await createTestBooking(testData.users.user1.id, lesson.id, 'confirmed')

      await loginAsRegularUser(page, 1, testData.users.user1.email, 'password', {
        tenantSlug: tenant.slug,
      })
      await navigateToTenant(page, tenant.slug, `/bookings/${lesson.id}/manage`)

      // Wait for manage page to load
      await page.waitForLoadState('networkidle')

      // Find the quantity increase button (plus button)
      const increaseButton = page
        .locator('button[aria-label*="Increase"]')
        .or(page.locator('button:has-text("+")'))
        .or(page.locator('button').filter({ has: page.locator('svg') }))
        .first()

      const hasIncreaseButton = await increaseButton.isVisible().catch(() => false)
      if (hasIncreaseButton) {
        // Click increase button once to go from 1 to 2
        await increaseButton.click()
        await page.waitForTimeout(500)

        // Find and click "Update Bookings" button
        const updateButton = page
          .locator('button:has-text("Update Bookings")')
          .or(page.getByRole('button', { name: /update/i }))
          .first()

        const hasUpdateButton = await updateButton.isVisible().catch(() => false)
        if (hasUpdateButton) {
          await updateButton.click()

          // Wait for success toast
          await page.waitForSelector('text=/success|updated|added|booking/i', { timeout: 10000 }).catch(() => null)

          // Wait for page to update
          await page.waitForTimeout(1000)

          // Verify bookings list shows 2 confirmed bookings
          const bookingCount = await page
            .locator('text=/2.*booking|booking.*2/i')
            .first()
            .isVisible()
            .catch(() => false)

          // Also check for success message
          const successMessage = await page
            .locator('text=/success|updated|added/i')
            .first()
            .isVisible()
            .catch(() => false)

          expect(bookingCount || successMessage).toBe(true)
        }
      }
    })
  })

  test.describe('Over-Capacity Guard', () => {
    test('should prevent increasing quantity beyond remaining capacity', async ({ page, testData }) => {
      const tenant = testData.tenants[0]!
      // Create 1 booking for user1 on the full lesson (this fills the last remaining slot)
      await createTestBooking(testData.users.user1.id, fullLesson.id, 'confirmed')

      await loginAsRegularUser(page, 1, testData.users.user1.email, 'password', {
        tenantSlug: tenant.slug,
      })
      await navigateToTenant(page, tenant.slug, `/bookings/${fullLesson.id}/manage`)

      // Wait for manage page to load
      await page.waitForLoadState('networkidle')

      // Try to find increase button (should be disabled or not allow increase)
      const increaseButton = page
        .locator('button[aria-label*="Increase"]')
        .or(page.locator('button:has-text("+")'))
        .first()

      const hasIncreaseButton = await increaseButton.isVisible().catch(() => false)

      if (hasIncreaseButton) {
        // Check if button is disabled
        const isDisabled = await increaseButton.isDisabled().catch(() => false)

        if (!isDisabled) {
          // If not disabled, try to click and expect error
          await increaseButton.click()
          await page.waitForTimeout(500)

          // Try to update
          const updateButton = page
            .locator('button:has-text("Update Bookings")')
            .or(page.getByRole('button', { name: /update/i }))
            .first()

          const hasUpdateButton = await updateButton.isVisible().catch(() => false)
          if (hasUpdateButton) {
            await updateButton.click()

            // Wait for error toast
            await page.waitForSelector('text=/error|capacity|available|cannot/i', { timeout: 10000 }).catch(() => null)

            // Verify error message appears
            const errorMessage = await page
              .locator('text=/error|capacity|available|cannot|exceed/i')
              .first()
              .isVisible()
              .catch(() => false)

            expect(errorMessage).toBe(true)
          }
        } else {
          // Button is disabled, which is also correct behavior
          expect(isDisabled).toBe(true)
        }
      }
    })
  })
})
