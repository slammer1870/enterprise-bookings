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
 * Helper function to ensure we're logged in as admin
 * Creates first user if needed, or assumes we're already logged in
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

test.describe('Admin Lesson Creation Flow', () => {
  test('should create class option, create lesson for tomorrow, and verify it exists', async ({
    page,
  }) => {
    // Step 1: Ensure we're logged in as admin
    await ensureAdminLoggedIn(page)

    // Step 2: Create a class option
    await page.goto('/admin/collections/class-options', { waitUntil: 'load', timeout: 60000 })

    // Click "Create new Class Option"
    await page.getByLabel('Create new Class Option').click()
    await page.waitForTimeout(1000)

    // Fill in the class option form
    await page.getByRole('textbox', { name: 'Name *' }).fill('Test Class')
    await page.getByRole('spinbutton', { name: 'Places *' }).fill('10')
    await page
      .getByRole('textbox', { name: 'Description *' })
      .fill('A test class option for e2e testing')

    // Type is already set to "adult" by default, so we can leave it

    // Save the class option
    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(2000)

    // Verify class option was created (should be on edit page)
    await expect(page).toHaveURL(/\/admin\/collections\/class-options\/\d+/)

    // Step 3: Create a lesson for tomorrow
    await page.goto('/admin/collections/lessons/create', { waitUntil: 'load', timeout: 60000 })

    // Calculate tomorrow's date
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowDateStr = tomorrow.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })

    // Set the date to tomorrow
    const dateInput = page.locator('#field-date').getByRole('textbox')
    await dateInput.click()
    await dateInput.clear()
    await dateInput.fill(tomorrowDateStr)
    await page.keyboard.press('Tab')
    await page.waitForTimeout(500)

    // Set start time to 10:00 AM
    const startTimeInput = page.locator('#field-startTime').getByRole('textbox')
    await startTimeInput.click()
    await page.waitForTimeout(300)

    // Try to select 10:00 AM from the time picker
    const startTimeOption = page.getByRole('option', { name: '10:00 AM' })
    if ((await startTimeOption.count()) > 0) {
      await startTimeOption.click()
    } else {
      // Fallback: type directly
      await startTimeInput.clear()
      await startTimeInput.fill('10:00 AM')
      await page.keyboard.press('Enter')
    }
    await page.waitForTimeout(500)

    // Set end time to 11:00 AM
    const endTimeInput = page.locator('#field-endTime').getByRole('textbox')
    await endTimeInput.click()
    await page.waitForTimeout(300)

    const endTimeOption = page.getByRole('option', { name: '11:00 AM' })
    if ((await endTimeOption.count()) > 0) {
      await endTimeOption.click()
    } else {
      // Fallback: type directly
      await endTimeInput.clear()
      await endTimeInput.fill('11:00 AM')
      await page.keyboard.press('Enter')
    }
    await page.waitForTimeout(500)

    // Select the class option we created
    const classOptionCombobox = page
      .locator('text=Class Option')
      .locator('..')
      .locator('[role="combobox"]')
      .first()
    await classOptionCombobox.click()
    await page.waitForTimeout(500)

    const testClassOption = page.getByRole('option', { name: 'Test Class' })
    await expect(testClassOption).toBeVisible({ timeout: 10000 })
    await testClassOption.click()
    await page.waitForTimeout(500)

    // Save the lesson
    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(2000)

    // Verify lesson was created (should be on edit page)
    await expect(page).toHaveURL(/\/admin\/collections\/lessons\/\d+/)

    // Step 4: Navigate to lessons page and verify the lesson exists for tomorrow
    await page.goto('/admin/collections/lessons', { waitUntil: 'load', timeout: 60000 })
    await page.waitForTimeout(2000)

    // Click on tomorrow's date in the calendar
    const tomorrowDay = tomorrow.getDate()
    const tomorrowButton = page.getByRole('button', {
      name: new RegExp(
        `Monday, December ${tomorrowDay}|Tuesday, December ${tomorrowDay}|Wednesday, December ${tomorrowDay}|Thursday, December ${tomorrowDay}|Friday, December ${tomorrowDay}|Saturday, December ${tomorrowDay}|Sunday, December ${tomorrowDay}`,
        'i',
      ),
    })

    // If the button text doesn't match exactly, try finding by the day number
    const dayButton = page
      .locator(`button:has-text("${tomorrowDay}")`)
      .filter({ hasNotText: /^\d+$/ })
      .first()

    if ((await dayButton.count()) > 0) {
      await dayButton.click()
    } else {
      // Fallback: click the button with the day number
      await page.locator(`button:has-text("${tomorrowDay}")`).first().click()
    }

    await page.waitForTimeout(2000)

    // Verify the lesson appears in the table
    // The table should show lessons for the selected date
    const lessonsTable = page.getByText(
      'Start TimeEnd TimeClass NameBookingsActions10:0011:00Test Class0Open menu',
    )
    await expect(lessonsTable).toBeVisible({ timeout: 10000 })

    // Check that the lesson exists - it should show the class name "Test Class"
  })
})
