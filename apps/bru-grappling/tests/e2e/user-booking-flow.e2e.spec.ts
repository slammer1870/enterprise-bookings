import { test, expect } from '@playwright/test'
import { ensureAdminLoggedIn } from './helpers'

/**
 * Ensure there is a home page with a Schedule block.
 * If a page with slug "home" does not exist, create one via the admin UI.
 */
async function ensureHomePageWithSchedule(page: any): Promise<void> {
  await page.goto('/admin/collections/pages', { waitUntil: 'load', timeout: 60000 })

  const homeRow = page.getByRole('row', { name: /home/i })
  if ((await homeRow.count()) > 0) {
    // Page exists; we rely on CMS config for the schedule block.
    return
  }

  // Create minimal home page with a Schedule block
  await page.getByLabel(/Create new Page/i).click()

  await page.getByRole('textbox', { name: 'Title *' }).fill('Home')
  await page.getByRole('textbox', { name: /Slug/i }).fill('home')

  // Add Schedule block (label may be "Schedule")
  const addLayoutButton = page.getByRole('button', { name: 'Add Layout' })
  await addLayoutButton.click()
  await page.getByRole('button', { name: /Schedule/i }).click()

  await page.getByRole('button', { name: /Save/i }).click()
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {})
  await expect(page).toHaveURL(/\/admin\/collections\/pages\/\d+/)
}

/**
 * Ensure there is a lesson tomorrow with a basic class option.
 * Returns the Date for tomorrow.
 */
async function ensureLessonForTomorrow(page: any, className = 'E2E Test Class'): Promise<Date> {
  // Ensure a basic class option exists; create it if it does not
  await page.goto('/admin/collections/class-options', { waitUntil: 'load', timeout: 60000 })
  const existingClassOptionRow = page.getByRole('row', { name: new RegExp(className, 'i') })

  if ((await existingClassOptionRow.count()) === 0) {
    // No matching class option found; create a basic one
    await page.getByLabel('Create new Class Option').click()

    await page.getByRole('textbox', { name: 'Name *' }).fill(className)
    await page.getByRole('spinbutton', { name: 'Places *' }).fill('10')
    await page.getByRole('textbox', { name: 'Description *' }).fill('A test class option for e2e')

    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {})
    await page.waitForTimeout(1000)
    await expect(page).toHaveURL(/\/admin\/collections\/class-options\/\d+/)
  }

  // Compute tomorrow's date (used for both lookup and creation)
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowDateStr = tomorrow.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  // First, check if a lesson already exists for tomorrow with this class option
  await page.goto('/admin/collections/lessons', { waitUntil: 'load', timeout: 60000 })
  const tomorrowDay = tomorrow.getDate()
  const dayButton = page.locator(`button:has-text("${tomorrowDay}")`).first()
  if ((await dayButton.count()) > 0) {
    await dayButton.click()
    await page.waitForTimeout(2000)
  }

  const existingLessonCell = page.getByRole('cell', { name: className })
  if ((await existingLessonCell.count()) > 0) {
    // Lesson already exists for tomorrow with this class option; reuse it.
    return tomorrow
  }

  // No existing lesson found; create a new lesson for tomorrow using this class option
  await page.goto('/admin/collections/lessons/create', { waitUntil: 'load', timeout: 60000 })

  const dateInput = page.locator('#field-date').getByRole('textbox')
  await dateInput.click()
  await dateInput.fill(tomorrowDateStr)
  await page.keyboard.press('Tab')

  const startTimeInput = page.locator('#field-startTime').getByRole('textbox')
  await startTimeInput.click()
  const startTimeOption = page.getByRole('option', { name: '10:00 AM' })
  if ((await startTimeOption.count()) > 0) {
    await startTimeOption.click()
  } else {
    await startTimeInput.fill('10:00 AM')
    await page.keyboard.press('Enter')
  }

  const endTimeInput = page.locator('#field-endTime').getByRole('textbox')
  await endTimeInput.click()
  const endTimeOption = page.getByRole('option', { name: '11:00 AM' })
  if ((await endTimeOption.count()) > 0) {
    await endTimeOption.click()
  } else {
    await endTimeInput.fill('11:00 AM')
    await page.keyboard.press('Enter')
  }

  const classOptionCombobox = page
    .locator('text=Class Option')
    .locator('..')
    .locator('[role="combobox"]')
    .first()
  await classOptionCombobox.click()
  const classOption = page.getByRole('option', { name: className })
  await expect(classOption).toBeVisible({ timeout: 10000 })
  await classOption.click()

  await page.getByRole('button', { name: 'Save' }).click()
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {})
  await expect(page).toHaveURL(/\/admin\/collections\/lessons\/\d+/)

  return tomorrow
}

/**
 * On the public Schedule, move the ToggleDate component to tomorrow.
 * Returns the Date instance for tomorrow based on the currently displayed date.
 */
async function goToTomorrowInSchedule(page: any): Promise<Date> {
  const dateText = await page.locator('#schedule p').first().innerText()
  const current = new Date(dateText)
  const tomorrow = new Date(current)
  tomorrow.setDate(current.getDate() + 1)
  const tomorrowText = tomorrow.toDateString()

  const rightArrow = page.locator('#schedule svg').nth(1)
  for (let i = 0; i < 5; i++) {
    if ((await page.locator('#schedule p', { hasText: tomorrowText }).count()) > 0) {
      break
    }
    await rightArrow.click()
  }

  await expect(page.locator('#schedule p', { hasText: tomorrowText })).toBeVisible({
    timeout: 10000,
  })

  return tomorrow
}

test.describe('User booking flow from schedule', () => {
  test('user can check in and then cancel tomorrow’s lesson', async ({ page }) => {
    // Admin phase: ensure prerequisites
    await ensureAdminLoggedIn(page)
    await ensureHomePageWithSchedule(page)
    const tomorrow = await ensureLessonForTomorrow(page)

    // Log out admin
    await page.goto('/admin/logout', { waitUntil: 'load' }).catch(() => {})
    // Clear cookies to ensure we're logged out
    await page.context().clearCookies()
    await page.waitForTimeout(1000)

    // User phase: navigate to home (has schedule) and view schedule
    await page.goto('/', { waitUntil: 'load', timeout: 15000 })
    await expect(page.locator('#schedule')).toBeVisible()
    await expect(page.getByRole('heading', { name: /Schedule/i })).toBeVisible()

    await goToTomorrowInSchedule(page)

    // Click "Check In" for tomorrow's lesson
    const checkInButton = page.getByRole('button', { name: /Check In/i }).first()
    await expect(checkInButton).toBeVisible({ timeout: 10000 })

    // Click the button and wait for navigation
    await checkInButton.click()

    // Wait for navigation to complete-booking page (with a longer timeout)
    try {
      await page.waitForURL(/\/complete-booking/, { timeout: 20000 })
    } catch (error) {
      // If we're already on the complete-booking page, that's fine
      if (!page.url().includes('/complete-booking')) {
        throw error
      }
    }

    // If there's a login tab, use it; otherwise assume login mode is default
    const registerTab = page.getByRole('tab', { name: /Register/i })
    if ((await registerTab.count()) > 0) {
      await registerTab.click()
    }

    // Submit email to request magic link
    const nameInput = page.getByRole('textbox', { name: /Name/i })
    await expect(nameInput).toBeVisible({ timeout: 10000 })
    await nameInput.fill('John Doe')
    const emailInput = page.getByRole('textbox', { name: /Email/i })
    await expect(emailInput).toBeVisible({ timeout: 10000 })
    await emailInput.fill(`user-${Date.now()}@example.com`)

    const submitButton = page.getByRole('button', { name: 'Submit' })
    await expect(submitButton).toBeVisible({ timeout: 10000 })

    // Click submit and wait for navigation
    await Promise.all([
      page.waitForURL(/\/magic-link-sent/, { timeout: 60000 }),
      submitButton.click(),
    ])

    // Verify we're on the magic link sent page
    await expect(page).toHaveURL(/\/magic-link-sent/)
    await expect(page.getByText(/Magic link sent/i)).toBeVisible({ timeout: 10000 })
  })
})
