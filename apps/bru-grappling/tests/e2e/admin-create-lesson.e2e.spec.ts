import { test, expect } from '@playwright/test'

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

/**
 * Helper function to ensure we're logged in as admin.
 * Creates first user if needed, or assumes we're already logged in.
 */
async function ensureAdminLoggedIn(page: any): Promise<void> {
  await page.goto('/admin', { waitUntil: 'load', timeout: 60000 })
  await page.waitForURL(/\/admin\/(login|create-first-user|$)/, { timeout: 10000 })

  // If we're on create-first-user page, create the admin user
  if (page.url().includes('/admin/create-first-user')) {
    await page.getByRole('textbox', { name: 'Email *' }).fill('admin@example.com')
    await page.getByRole('textbox', { name: 'New Password' }).fill('password123')
    await page.getByRole('textbox', { name: 'Confirm Password' }).fill('password123')

    // Select Admin role
    const roleCombobox = page
      .locator('text=Role')
      .locator('..')
      .locator('[role="combobox"]')
      .first()
    await roleCombobox.click()
    await page.getByRole('option', { name: 'Admin' }).click()
    await page.waitForTimeout(500)

    // Check Email Verified checkbox
    await page.getByRole('checkbox', { name: 'Email Verified *' }).setChecked(true)

    // Click Create button
    await page.getByRole('button', { name: 'Create' }).click()
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(2000)
  }

  // If we're on login page, try to login (assuming user exists)
  if (page.url().includes('/admin/login')) {
    await page.getByRole('textbox', { name: 'Email' }).fill('admin@example.com')
    await page.getByRole('textbox', { name: 'Password' }).fill('password123')
    await page.getByRole('button', { name: 'Login' }).click()
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(2000)
  }

  // Should be on admin dashboard now
  await expect(page).toHaveURL(/\/admin$/)
}

/**
 * Helper to create a class option with optional payment method configuration.
 */
async function createClassOption(page: any, options: { name: string; description: string; places?: string }) {
  const { name, description, places = '10' } = options

  await page.goto('/admin/collections/class-options', { waitUntil: 'load', timeout: 60000 })
  await page.getByLabel('Create new Class Option').click()
  await page.waitForTimeout(1000)

  await page.getByRole('textbox', { name: 'Name *' }).fill(name)
  await page.getByRole('spinbutton', { name: 'Places *' }).fill(places)
  await page.getByRole('textbox', { name: 'Description *' }).fill(description)
}

/**
 * Helper to set the lesson date to tomorrow and time to 10:00–11:00.
 * Returns the Date instance for tomorrow.
 */
async function setLessonTomorrowAtTenToEleven(page: any): Promise<Date> {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)

  const tomorrowDateStr = tomorrow.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  const dateInput = page.locator('#field-date').getByRole('textbox')
  await dateInput.click()
  await dateInput.clear()
  await dateInput.fill(tomorrowDateStr)
  await page.keyboard.press('Tab')
  await page.waitForTimeout(500)

  const startTimeInput = page.locator('#field-startTime').getByRole('textbox')
  await startTimeInput.click()
  await page.waitForTimeout(300)
  const startTimeOption = page.getByRole('option', { name: '10:00 AM' })
  if ((await startTimeOption.count()) > 0) {
    await startTimeOption.click()
  } else {
    await startTimeInput.clear()
    await startTimeInput.fill('10:00 AM')
    await page.keyboard.press('Enter')
  }
  await page.waitForTimeout(500)

  const endTimeInput = page.locator('#field-endTime').getByRole('textbox')
  await endTimeInput.click()
  await page.waitForTimeout(300)
  const endTimeOption = page.getByRole('option', { name: '11:00 AM' })
  if ((await endTimeOption.count()) > 0) {
    await endTimeOption.click()
  } else {
    await endTimeInput.clear()
    await endTimeInput.fill('11:00 AM')
    await page.keyboard.press('Enter')
  }
  await page.waitForTimeout(500)

  return tomorrow
}

/**
 * Helper to select a class option in the lesson form and save the lesson.
 */
async function selectClassOptionAndSaveLesson(page: any, className: string): Promise<void> {
  const classOptionCombobox = page
    .locator('text=Class Option')
    .locator('..')
    .locator('[role="combobox"]')
    .first()
  await classOptionCombobox.click()
  await page.waitForTimeout(500)

  const createdOption = page.getByRole('option', { name: className })
  await expect(createdOption).toBeVisible({ timeout: 10000 })
  await createdOption.click()
  await page.waitForTimeout(500)

  await page.getByRole('button', { name: 'Save' }).click()
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(2000)
  await expect(page).toHaveURL(/\/admin\/collections\/lessons\/\d+/)
}

/**
 * Helper to navigate to the lessons list for tomorrow and assert the class name exists.
 */
async function expectLessonVisibleForTomorrow(page: any, tomorrow: Date, className: string): Promise<void> {
  await page.goto('/admin/collections/lessons', { waitUntil: 'load', timeout: 60000 })
  await page.waitForTimeout(2000)

  const tomorrowDay = tomorrow.getDate()
  const dayButton = page
    .locator(`button:has-text("${tomorrowDay}")`)
    .filter({ hasNotText: /^\d+$/ })
    .first()

  if ((await dayButton.count()) > 0) {
    await dayButton.click()
  } else {
    await page.locator(`button:has-text("${tomorrowDay}")`).first().click()
  }

  await page.waitForTimeout(2000)
  await expect(page.getByRole('cell', { name: className })).toBeVisible({
    timeout: 10000,
  })
}

test.describe('Admin Lesson Creation Flow', () => {
  test('should create class option, create lesson for tomorrow, and verify it exists', async ({
    page,
  }) => {
    // Step 1: Ensure we're logged in as admin
    await ensureAdminLoggedIn(page)

    // Step 2: Create a class option
    await createClassOption(page, {
      name: 'Test Class',
      description: 'A test class option for e2e testing',
    })

    // Type is already set to "adult" by default, so we can leave it

    // Save the class option
    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(2000)

    // Verify class option was created (should be on edit page)
    await expect(page).toHaveURL(/\/admin\/collections\/class-options\/\d+/)

    // Step 3: Create a lesson for tomorrow
    await page.goto('/admin/collections/lessons/create', { waitUntil: 'load', timeout: 60000 })
    const tomorrow = await setLessonTomorrowAtTenToEleven(page)

    await selectClassOptionAndSaveLesson(page, 'Test Class')

    // Step 4: Navigate to lessons page and verify the lesson exists for tomorrow
    await expectLessonVisibleForTomorrow(page, tomorrow, 'Test Class')
  })

  test('should create lesson for class option with drop-in payment only', async ({ page }) => {
    await ensureAdminLoggedIn(page)

    const className = 'Test Class Drop In'
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

    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(2000)
    await expect(page).toHaveURL(/\/admin\/collections\/class-options\/\d+/)

    // Create a lesson for tomorrow using this class option
    await page.goto('/admin/collections/lessons/create', { waitUntil: 'load', timeout: 60000 })
    const tomorrow = await setLessonTomorrowAtTenToEleven(page)

    await selectClassOptionAndSaveLesson(page, className)
    await expectLessonVisibleForTomorrow(page, tomorrow, className)
  })

  test('should create lesson for class option with subscription payment only', async ({ page }) => {
    await ensureAdminLoggedIn(page)

    const className = 'Test Class Subscription'
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

    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(2000)
    await expect(page).toHaveURL(/\/admin\/collections\/class-options\/\d+/)

    // Create a lesson for tomorrow using this class option
    await page.goto('/admin/collections/lessons/create', { waitUntil: 'load', timeout: 60000 })
    const tomorrow = await setLessonTomorrowAtTenToEleven(page)

    await selectClassOptionAndSaveLesson(page, className)
    await expectLessonVisibleForTomorrow(page, tomorrow, className)
  })

  test('should create lesson for class option with drop-in and subscription payments', async ({
    page,
  }) => {
    await ensureAdminLoggedIn(page)

    const className = 'Test Class Drop In + Subscription'
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

    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(2000)
    await expect(page).toHaveURL(/\/admin\/collections\/class-options\/\d+/)

    // Create a lesson for tomorrow using this class option
    await page.goto('/admin/collections/lessons/create', { waitUntil: 'load', timeout: 60000 })
    const tomorrow = await setLessonTomorrowAtTenToEleven(page)

    await selectClassOptionAndSaveLesson(page, className)
    await expectLessonVisibleForTomorrow(page, tomorrow, className)
  })
})
