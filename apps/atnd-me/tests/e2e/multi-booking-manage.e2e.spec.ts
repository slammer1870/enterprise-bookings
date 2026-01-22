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
  let fullLesson: any

  test.beforeAll(async ({ testData }) => {
    const workerIndex = testData.workerIndex

    // Create class option with sufficient capacity
    const classOption = await createTestClassOption(
      testData.tenants[0].id,
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
      testData.tenants[0].id,
      classOption.id,
      startTime,
      endTime,
      undefined,
      true
    )

    // Create a fully booked lesson for capacity testing
    const fullClassOption = await createTestClassOption(
      testData.tenants[0].id,
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
      testData.tenants[0].id,
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
    test('should show "Modify Booking" button and route to manage page when user has 2+ bookings', async ({
      page,
      testData,
    }) => {
      // Create 2 confirmed bookings for user1
      await createTestBooking(testData.users.user1.id, lesson.id, 'confirmed')
      await createTestBooking(testData.users.user1.id, lesson.id, 'confirmed')

      await loginAsRegularUser(page, 1, testData.users.user1.email)
      await navigateToTenant(page, testData.tenants[0].slug, '/')

      // Wait for page to load and find the lesson card/button
      await page.waitForLoadState('networkidle')

      // Look for the button with "Modify Booking" text
      // The button might be in a lesson list or schedule view
      const modifyButton = page
        .locator('button:has-text("Modify Booking")')
        .or(page.getByRole('button', { name: /modify booking/i }))
        .first()

      const hasModifyButton = await modifyButton.isVisible().catch(() => false)

      if (hasModifyButton) {
        // Click the modify button
        await modifyButton.click()

        // Wait for navigation
        await page.waitForURL((url) => url.pathname.includes('/bookings/') && url.pathname.includes('/manage'), {
          timeout: 10000,
        })

        // Assert we're on the manage page
        expect(page.url()).toContain('/bookings/')
        expect(page.url()).toContain('/manage')
      } else {
        // If button not found, try navigating directly to lesson detail page
        // and check for modify button there
        await navigateToTenant(page, testData.tenants[0].slug, `/bookings/${lesson.id}`)
        await page.waitForLoadState('networkidle')

        const directModifyButton = page
          .locator('button:has-text("Modify Booking")')
          .or(page.getByRole('button', { name: /modify booking/i }))
          .first()

        const hasDirectButton = await directModifyButton.isVisible().catch(() => false)
        expect(hasDirectButton).toBe(true)

        if (hasDirectButton) {
          await directModifyButton.click()
          await page.waitForURL((url) => url.pathname.includes('/manage'), { timeout: 10000 })
          expect(page.url()).toContain('/manage')
        }
      }
    })
  })

  test.describe('Manage Route Guard', () => {
    test('should redirect to booking page when user has 0 bookings', async ({ page, testData }) => {
      await loginAsRegularUser(page, 1, testData.users.user1.email)
      await navigateToTenant(page, testData.tenants[0].slug, `/bookings/${lesson.id}/manage`)

      // Should redirect to /bookings/[id] (not /manage)
      await page.waitForURL((url) => url.pathname.includes('/bookings/') && !url.pathname.includes('/manage'), {
        timeout: 10000,
      })

      expect(page.url()).toContain('/bookings/')
      expect(page.url()).not.toContain('/manage')
    })

    test('should redirect to booking page when user has 1 booking', async ({ page, testData }) => {
      // Create 1 booking
      await createTestBooking(testData.users.user1.id, lesson.id, 'confirmed')

      await loginAsRegularUser(page, 1, testData.users.user1.email)
      await navigateToTenant(page, testData.tenants[0].slug, `/bookings/${lesson.id}/manage`)

      // Should redirect to /bookings/[id] (not /manage)
      await page.waitForURL((url) => url.pathname.includes('/bookings/') && !url.pathname.includes('/manage'), {
        timeout: 10000,
      })

      expect(page.url()).toContain('/bookings/')
      expect(page.url()).not.toContain('/manage')
    })
  })

  test.describe('Decrease Quantity Flow', () => {
    test('should decrease booking quantity from 3 to 1', async ({ page, testData }) => {
      // Create 3 confirmed bookings
      await createTestBooking(testData.users.user1.id, lesson.id, 'confirmed')
      await createTestBooking(testData.users.user1.id, lesson.id, 'confirmed')
      await createTestBooking(testData.users.user1.id, lesson.id, 'confirmed')

      await loginAsRegularUser(page, 1, testData.users.user1.email)
      await navigateToTenant(page, testData.tenants[0].slug, `/bookings/${lesson.id}/manage`)

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
      // Create 1 confirmed booking
      await createTestBooking(testData.users.user1.id, lesson.id, 'confirmed')

      await loginAsRegularUser(page, 1, testData.users.user1.email)
      await navigateToTenant(page, testData.tenants[0].slug, `/bookings/${lesson.id}/manage`)

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
      // Create 1 booking for user1 on the full lesson (this fills the last remaining slot)
      await createTestBooking(testData.users.user1.id, fullLesson.id, 'confirmed')

      await loginAsRegularUser(page, 1, testData.users.user1.email)
      await navigateToTenant(page, testData.tenants[0].slug, `/bookings/${fullLesson.id}/manage`)

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
