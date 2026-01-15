import { test, expect } from '@playwright/test'
import {
  ensureAdminLoggedIn,
  saveObjectAndWaitForNavigation,
  waitForServerReady,
} from './helpers'
import { createClassOption, setLessonTomorrowAtTenToEleven, uniqueClassName } from '@repo/testing-config/src/playwright'

/**
 * E2E test for admin lesson creation flow
 * Tests the complete flow:
 * 1. Navigate to /admin and create first user or login
 * 2. Create a class option
 * 3. Create a lesson for tomorrow
 * 4. Navigate to tomorrow in the lessons view to confirm it exists
 *
 * Note: These tests require a fresh database. If users already exist,
 * the tests will handle login instead of creating first user.
 */

// shared helpers now come from @repo/testing-config (bru-grappling as standard)

/**
 * Helper to select a class option in the lesson form and save the lesson.
 */
async function selectClassOptionAndSaveLesson(page: any, className: string): Promise<void> {
  const classOptionCombobox = page
    .locator('text=Class Option')
    .locator('..')
    .locator('[role="combobox"]')
    .first()
  
  // Ensure combobox is visible and clickable
  await expect(classOptionCombobox).toBeVisible({ timeout: 10000 })
  await classOptionCombobox.click()
  await page.waitForTimeout(500)

  // Wait for and select the option
  const createdOption = page.getByRole('option', { name: className })
  await expect(createdOption).toBeVisible({ timeout: 10000 })
  await createdOption.click()
  
  // Wait for dropdown to close and selection to be applied
  await page.waitForTimeout(1000)
  
  // Ensure the dropdown is closed before proceeding
  await expect(createdOption)
    .not.toBeVisible({ timeout: 3000 })
    .catch(() => {
    // If dropdown is still open, press Escape to close it
    return page.keyboard.press('Escape')
  })

  // Save lesson with ID extraction fallback
  await saveObjectAndWaitForNavigation(page, {
    apiPath: '/api/lessons',
    expectedUrlPattern: /\/admin\/collections\/lessons\/\d+/,
    collectionName: 'lessons',
  })
}

/**
 * Helper to navigate to the lessons list for tomorrow and assert the class name exists.
 */
async function expectLessonVisibleForTomorrow(
  page: any,
  tomorrow: Date,
  className: string,
): Promise<void> {
  // Best practice: avoid scraping slow/filtered admin tables to assert backend state.
  // Verify via Payload REST API using the already-authenticated browser context.
  const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000'
  const req = page.context().request

  const classRes = await req.get(
    `${baseUrl}/api/class-options?where[name][equals]=${encodeURIComponent(className)}&limit=1&depth=0`,
    { timeout: 120000 },
  )
  if (!classRes.ok()) {
    const txt = await classRes.text().catch(() => '')
    throw new Error(`Failed to query class option by name: ${classRes.status()} ${txt}`)
  }
  const classJson: any = await classRes.json().catch(() => null)
  const classOptionId = classJson?.docs?.[0]?.id
  if (!classOptionId) {
    throw new Error(`Class option not found via API for name "${className}"`)
  }

  const start = new Date(tomorrow)
  start.setHours(0, 0, 0, 0)
  const end = new Date(tomorrow)
  end.setHours(23, 59, 59, 999)

  const lessonRes = await req.get(
    `${baseUrl}/api/lessons?where[and][0][startTime][greater_than_equal]=${encodeURIComponent(start.toISOString())}` +
      `&where[and][1][startTime][less_than_equal]=${encodeURIComponent(end.toISOString())}` +
      `&where[and][2][classOption][equals]=${encodeURIComponent(String(classOptionId))}` +
      `&limit=10&depth=0`,
    { timeout: 120000 },
  )

  if (!lessonRes.ok()) {
    const txt = await lessonRes.text().catch(() => '')
    throw new Error(`Failed to query lessons via API: ${lessonRes.status()} ${txt}`)
  }

  const lessonJson: any = await lessonRes.json().catch(() => null)
  const docs: any[] = Array.isArray(lessonJson?.docs) ? lessonJson.docs : []
  if (docs.length === 0) {
    throw new Error(
      `Lesson not found via API for class "${className}" on ${start.toISOString().slice(0, 10)}. ` +
        `Queried by classOption=${classOptionId} between ${start.toISOString()} and ${end.toISOString()}.`,
    )
  }
}

test.describe('Admin Lesson Creation Flow', () => {
  // Allow extra headroom on CI where dev server recompiles are slow
  test.setTimeout(180000)
  test('should create class option, create lesson for tomorrow, and verify it exists', async ({
    page,
  }) => {
    // Step 1: Ensure we're logged in as admin
    await ensureAdminLoggedIn(page)

    // Step 2: Create a class option (name must be unique)
    const className = uniqueClassName('Test Class')
    await createClassOption(page, {
      name: className,
      description: 'A test class option for e2e testing',
    })

    // Type is already set to "adult" by default, so we can leave it

    // Save the class option with ID extraction fallback
    await saveObjectAndWaitForNavigation(page, {
      apiPath: '/api/class-options',
      expectedUrlPattern: /\/admin\/collections\/class-options\/\d+/,
      collectionName: 'class-options',
    })

    // Step 3: Create a lesson for tomorrow
    await page.goto('/admin/collections/lessons/create', { waitUntil: 'load', timeout: 120000 })
    const tomorrow = await setLessonTomorrowAtTenToEleven(page)

    await selectClassOptionAndSaveLesson(page, className)

    // Step 4: Navigate to lessons page and verify the lesson exists for tomorrow
    await expectLessonVisibleForTomorrow(page, tomorrow, className)
  })

  test('should create lesson for class option with drop-in payment only', async ({ page }) => {
    await ensureAdminLoggedIn(page)

    const className = uniqueClassName('Test Class Drop In')
    const description = 'A test class option with drop-in payment'

    // Create a class option configured for drop-in payments only
    await createClassOption(page, {
      name: className,
      description,
    })

    // Configure payment methods: Allowed Drop In (assumes at least one drop-in exists)
    const allowedDropInCombobox = page
      .locator('text=Allowed Drop In')
      .locator('..')
      .locator('[role="combobox"]')
      .first()

    if ((await allowedDropInCombobox.count()) > 0) {
      await allowedDropInCombobox.click()
      const firstDropInOption = page.getByRole('option').first()
      if (await firstDropInOption.isVisible()) {
        await firstDropInOption.click()
      }
    }

    await saveObjectAndWaitForNavigation(page, {
      apiPath: '/api/class-options',
      expectedUrlPattern: /\/admin\/collections\/class-options\/\d+/,
      collectionName: 'class-options',
    })

    // Create a lesson for tomorrow using this class option
    await page.goto('/admin/collections/lessons/create', { waitUntil: 'load', timeout: 120000 })
    const tomorrow = await setLessonTomorrowAtTenToEleven(page)

    await selectClassOptionAndSaveLesson(page, className)
    await expectLessonVisibleForTomorrow(page, tomorrow, className)
  })

  test('should create lesson for class option with subscription payment only', async ({ page }) => {
    await ensureAdminLoggedIn(page)

    const className = uniqueClassName('Test Class Subscription')
    const description = 'A test class option with subscription payment'

    // Create a class option configured for subscription-only access
    await createClassOption(page, {
      name: className,
      description,
    })

    // Configure payment methods: Allowed Plans (assumes at least one plan exists)
    const allowedPlansCombobox = page
      .locator('text=Allowed Plans')
      .locator('..')
      .locator('[role="combobox"]')
      .first()

    if ((await allowedPlansCombobox.count()) > 0) {
      await allowedPlansCombobox.click()
      const firstPlanOption = page.getByRole('option').first()
      if (await firstPlanOption.isVisible()) {
        await firstPlanOption.click()
      }
    }

    await saveObjectAndWaitForNavigation(page, {
      apiPath: '/api/class-options',
      expectedUrlPattern: /\/admin\/collections\/class-options\/\d+/,
      collectionName: 'class-options',
    })

    // Create a lesson for tomorrow using this class option
    await page.goto('/admin/collections/lessons/create', { waitUntil: 'load', timeout: 120000 })
    const tomorrow = await setLessonTomorrowAtTenToEleven(page)

    await selectClassOptionAndSaveLesson(page, className)
    await expectLessonVisibleForTomorrow(page, tomorrow, className)
  })

  test('should create lesson for class option with drop-in and subscription payments', async ({
    page,
  }) => {
    await ensureAdminLoggedIn(page)

    const className = uniqueClassName('Test Class Drop In + Subscription')
    const description = 'A test class option with both drop-in and subscription payments'

    // Create a class option configured for both drop-in and subscription
    await createClassOption(page, {
      name: className,
      description,
    })

    const allowedDropInCombobox = page
      .locator('text=Allowed Drop In')
      .locator('..')
      .locator('[role="combobox"]')
      .first()

    if ((await allowedDropInCombobox.count()) > 0) {
      await allowedDropInCombobox.click()
      const firstDropInOption = page.getByRole('option').first()
      if (await firstDropInOption.isVisible()) {
        await firstDropInOption.click()
      }
    }

    const allowedPlansCombobox = page
      .locator('text=Allowed Plans')
      .locator('..')
      .locator('[role="combobox"]')
      .first()

    if ((await allowedPlansCombobox.count()) > 0) {
      await allowedPlansCombobox.click()
      const firstPlanOption = page.getByRole('option').first()
      if (await firstPlanOption.isVisible()) {
        await firstPlanOption.click()
      }
    }

    await saveObjectAndWaitForNavigation(page, {
      apiPath: '/api/class-options',
      expectedUrlPattern: /\/admin\/collections\/class-options\/\d+/,
      collectionName: 'class-options',
    })

    // Create a lesson for tomorrow using this class option
    await page.goto('/admin/collections/lessons/create', { waitUntil: 'load', timeout: 120000 })
    const tomorrow = await setLessonTomorrowAtTenToEleven(page)

    await selectClassOptionAndSaveLesson(page, className)
    await expectLessonVisibleForTomorrow(page, tomorrow, className)
  })
})
