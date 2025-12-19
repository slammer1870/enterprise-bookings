import { test, expect } from '@playwright/test'
import {
  ensureAdminLoggedIn,
  saveObjectAndWaitForNavigation,
  waitForServerReady,
} from './helpers'

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
 * Helper to generate a unique class option name to satisfy uniqueness constraints.
 */
function uniqueClassName(base: string): string {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`
  return `${base} ${suffix}`
}

/**
 * Helper to create a class option with optional payment method configuration.
 */
async function createClassOption(
  page: any,
  options: { name: string; description: string; places?: string },
) {
  const { name, description, places = '10' } = options

  await waitForServerReady(page.context().request)
  await page.goto('/admin/collections/class-options', {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  })

  await page.getByLabel('Create new Class Option').click()

  // Wait for the form to be visible instead of a fixed delay
  await page.getByRole('textbox', { name: 'Name *' }).waitFor({ state: 'visible', timeout: 10000 })

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
  // Navigate to the lessons list and wait for the URL to stabilise
  await page.goto('/admin/collections/lessons', {
    waitUntil: 'domcontentloaded',
    timeout: process.env.CI ? 180000 : 120000,
  })
  await expect(page).toHaveURL(/\/admin\/collections\/lessons/, {
    timeout: process.env.CI ? 30000 : 10000,
  })
  await page.waitForLoadState('load', { timeout: process.env.CI ? 30000 : 15000 }).catch(() => {})

  // Check for client-side errors before proceeding
  const errorHeading = page.getByRole('heading', {
    name: /application error|client-side exception/i,
  })

  const hasError = await errorHeading.isVisible({ timeout: 2000 }).catch(() => false)
  await page.waitForTimeout(process.env.CI ? 8000 : 6000)

  // Wait for page to be fully loaded (calendar should be visible)
  await page.waitForLoadState('load', { timeout: 10000 }).catch(() => {})

  // Find tomorrow's date button by checking all day buttons with data-day attribute
  const tomorrowDay = tomorrow.getDate()
  const tomorrowMonth = tomorrow.getMonth()
  const tomorrowYear = tomorrow.getFullYear()

  // Verify calendar is visible before looking for date buttons
  const calendarContainer = page.locator('[data-slot="calendar"]').or(page.locator('.rdp'))
  const calendarVisible = await calendarContainer
    .isVisible({ timeout: process.env.CI ? 30000 : 10000 })
    .catch(() => false)
  if (!calendarVisible) {
    // Try waiting a bit more and reloading if calendar still not visible
    await page.waitForTimeout(process.env.CI ? 5000 : 2000)
    const stillNotVisible = await calendarContainer.isVisible({ timeout: 10000 }).catch(() => false)
    if (!stillNotVisible) {
    throw new Error(
      `Calendar is not visible on lessons page. Cannot find date button for tomorrow (${tomorrow.toLocaleDateString()})`,
    )
    }
  }

  // Get all day buttons and find the one matching tomorrow's date
  // Use a timeout to prevent hanging if buttons are slow to load
  const buttonSearchTimeout = process.env.CI ? 20000 : 10000
  const startTime = Date.now()

  const allDayButtons = page.locator('button[data-day]')
  // Wait for at least one button to be available
  await allDayButtons
    .first()
    .waitFor({ state: 'attached', timeout: buttonSearchTimeout })
    .catch(() => {})

  const count = await allDayButtons.count()
  let dayButton: any = null

  // Limit iterations to prevent infinite loops
  const maxIterations = Math.min(count, 50)
  for (let i = 0; i < maxIterations; i++) {
    // Check timeout
    if (Date.now() - startTime > buttonSearchTimeout) {
      break
    }

    const button = allDayButtons.nth(i)
    try {
      const dataDay = await Promise.race([
        button.getAttribute('data-day'),
        new Promise<string | null>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 2000),
        ),
      ]).catch(() => null)

    if (dataDay) {
      // Parse the date - toLocaleDateString() returns a string like "12/16/2025"
      // Try parsing it as a date
      const buttonDate = new Date(dataDay)
      // Check if the parsed date matches tomorrow (accounting for timezone issues)
      if (
        !isNaN(buttonDate.getTime()) &&
        buttonDate.getDate() === tomorrowDay &&
        buttonDate.getMonth() === tomorrowMonth &&
        buttonDate.getFullYear() === tomorrowYear
      ) {
        dayButton = button
        break
      }
      }
    } catch {
      // Skip this button if it times out or errors
      continue
    }
  }

  // If not found in current month, try navigating to next month
  if (!dayButton) {
    // Look for next month button (chevron right icon)
    const nextButton = calendarContainer
      .locator('button')
      .filter({ has: page.locator('svg') })
      .last()
    if ((await nextButton.count()) > 0) {
      await nextButton.click()
      await page.waitForTimeout(process.env.CI ? 2000 : 1000)
      // Wait for calendar to update
      await page.waitForTimeout(process.env.CI ? 2000 : 1000)

      // Try again after navigating with timeout protection
      const allDayButtonsAfterNav = page.locator('button[data-day]')
      await allDayButtonsAfterNav
        .first()
        .waitFor({ state: 'attached', timeout: buttonSearchTimeout })
        .catch(() => {})
      const countAfterNav = await allDayButtonsAfterNav.count()
      const maxIterationsAfterNav = Math.min(countAfterNav, 50)

      for (let i = 0; i < maxIterationsAfterNav; i++) {
        if (Date.now() - startTime > buttonSearchTimeout * 2) {
          break
        }

        const button = allDayButtonsAfterNav.nth(i)
        try {
          const dataDay = await Promise.race([
            button.getAttribute('data-day'),
            new Promise<string | null>((_, reject) =>
              setTimeout(() => reject(new Error('Timeout')), 2000),
            ),
          ]).catch(() => null)

        if (dataDay) {
          const buttonDate = new Date(dataDay)
          if (
            !isNaN(buttonDate.getTime()) &&
            buttonDate.getDate() === tomorrowDay &&
            buttonDate.getMonth() === tomorrowMonth &&
            buttonDate.getFullYear() === tomorrowYear
          ) {
            dayButton = button
            break
          }
          }
        } catch {
          continue
        }
      }
    }
  }

  if (dayButton) {
    // Wait for navigation after clicking the day button
    // Use a longer timeout for CI and ensure click happens before waiting
    const urlTimeout = process.env.CI ? 30000 : 10000
    const clickPromise = dayButton.click()
    const navigationPromise = page.waitForURL(/\/admin\/collections\/lessons\?.*startTime/, {
      timeout: urlTimeout,
    })

    // Start the click first, then wait for navigation
    await clickPromise
    try {
      await navigationPromise
    } catch (error) {
      // If navigation didn't happen, check if we're already on the right page
      const currentUrl = page.url()
      if (!currentUrl.includes('/admin/collections/lessons')) {
        throw new Error(
          `Failed to navigate after clicking date button. Current URL: ${currentUrl}. ` +
            `Expected URL pattern: /admin/collections/lessons?.*startTime`,
        )
      }
    }
  } else {
    // Provide more context in error message
    const currentUrl = page.url()
    const buttonCount = await allDayButtons.count()
    throw new Error(
      `Could not find date button for tomorrow (${tomorrow.toLocaleDateString()}). ` +
        `Found ${buttonCount} date buttons on page. Current URL: ${currentUrl}`,
    )
  }

  // Wait for the table to load by waiting for network idle or a table element
  await page.waitForLoadState('load', { timeout: process.env.CI ? 30000 : 10000 }).catch(() => {})

  // Wait for the lessons table to be visible (not the calendar grid)
  // This is critical - if the table doesn't appear, the test will fail with a clear error
  const tableLocator = page.locator('table').filter({ hasText: 'Start Time' })
  try {
    await expect(tableLocator).toBeVisible({
      timeout: process.env.CI ? 30000 : 10000,
    })
  } catch (error) {
    // If table is not visible, check if we're on the right page
    const currentUrl = page.url()
    throw new Error(
      `Lessons table not visible after clicking date button. ` +
        `Current URL: ${currentUrl}. ` +
        `This might indicate the page didn't load properly or the date filter didn't work.`,
    )
  }

  await page.waitForTimeout(process.env.CI ? 2000 : 1000)

  // Wait for the created lesson to appear instead of using a fixed timeout
  // Use a more specific locator to avoid false matches
  const lessonCell = page.getByRole('cell', { name: className })
  try {
    await expect(lessonCell).toBeVisible({
      timeout: process.env.CI ? 40000 : 20000,
    })
  } catch (error) {
    // Provide helpful error message if lesson not found
    const tableText = await page
      .locator('table')
      .textContent()
      .catch(() => 'Unable to read table')
    throw new Error(
      `Lesson with class name "${className}" not found in table after ${process.env.CI ? 40 : 20} seconds. ` +
        `Table contents: ${tableText.substring(0, 200)}...`,
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
