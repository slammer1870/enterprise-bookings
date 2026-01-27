import { test, expect } from '@playwright/test'
import {
  clearTestMagicLinks,
  ensureAdminLoggedIn,
  ensureLessonForTomorrowWithSubscription,
  mockPaymentIntentSucceededWebhook,
  mockSubscriptionCreatedWebhook,
  pollForTestMagicLink,
  saveObjectAndWaitForNavigation,
  waitForServerReady,
} from './helpers'
import { ensureHomePageWithSchedule, goToTomorrowInSchedule } from '@repo/testing-config/src/playwright'

/**
 * Ensure there is a lesson tomorrow with a basic class option.
 * Returns the Date for tomorrow.
 */
async function ensureLessonForTomorrow(page: any, className = 'E2E Test Class'): Promise<Date> {
  // Ensure a basic class option exists; create it if it does not
  await page.goto('/admin/collections/class-options', {
    waitUntil: 'load',
    timeout: process.env.CI ? 120000 : 60000,
  })
  const existingClassOptionRow = page.getByRole('row', { name: new RegExp(className, 'i') })

  if ((await existingClassOptionRow.count()) === 0) {
    // No matching class option found; create a basic one
    await page.getByLabel('Create new Class Option').click()

    await page
      .waitForURL(/\/admin\/collections\/class-options\/create/, {
        timeout: process.env.CI ? 60000 : 30000,
        waitUntil: 'domcontentloaded',
      })
      .catch(async () => {
        await page.goto('/admin/collections/class-options/create', {
          waitUntil: 'domcontentloaded',
          timeout: process.env.CI ? 60000 : 30000,
        })
      })

    await page.getByRole('textbox', { name: 'Name *' }).fill(className)
    await page.getByRole('spinbutton', { name: 'Places *' }).fill('10')
    await page.getByRole('textbox', { name: 'Description *' }).fill('A test class option for e2e')

    await saveObjectAndWaitForNavigation(page, {
      apiPath: '/api/class-options',
      expectedUrlPattern: /\/admin\/collections\/class-options\/\d+/,
      collectionName: 'class-options',
    })
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
  await page.goto('/admin/collections/lessons', {
    waitUntil: 'load',
    timeout: process.env.CI ? 180000 : 60000,
  })
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
  await page.goto('/admin/collections/lessons/create', { waitUntil: 'load', timeout: 120000 })

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

  // Save lesson with ID extraction fallback
  await saveObjectAndWaitForNavigation(page, {
    apiPath: '/api/lessons',
    expectedUrlPattern: /\/admin\/collections\/lessons\/\d+/,
    collectionName: 'lessons',
  })

  return tomorrow
}

/**
 * Ensure there is at least one Drop In product available in the admin.
 * Returns the name of a Drop In we can select.
 */
async function ensureAtLeastOneDropIn(page: any): Promise<string> {
  await page.goto('/admin/collections/drop-ins', { waitUntil: 'domcontentloaded', timeout: 120000 })

  // If a drop-in already exists, reuse it (any row beyond the header).
  const rows = page.getByRole('row')
  const rowCount = await rows.count()
  if (rowCount > 1) {
    // Grab a stable text value from the first data row.
    // Payload list rows often contain the name as a link.
    const firstDataRow = rows.nth(1)
    const firstLink = firstDataRow.getByRole('link').first()
    const linkText = (await firstLink.textContent().catch(() => ''))?.trim()
    if (linkText) return linkText

    // Fallback: just return a generic name and let selection pick the first option later.
    return 'Drop In'
  }

  const dropInName = `E2E Drop In ${Date.now()}`

  // Create a new Drop In
  // "Create new Drop In" is a link in Payload 3.64.0
  const createLink = page.getByRole('link', { name: /Create new.*Drop In/i })
  if ((await createLink.count()) > 0) {
    await createLink.first().click()
  } else {
    // Fallback for older/newer Payload UI labels
    await page.getByRole('button', { name: /Create new.*Drop In/i }).click()
  }

  await page.getByRole('textbox', { name: 'Name *' }).waitFor({ state: 'visible', timeout: 20000 })
  await page.getByRole('textbox', { name: 'Name *' }).fill(dropInName)

  // Price is required on the DropIn type
  const priceInput = page.getByRole('spinbutton', { name: /Price/i })
  if ((await priceInput.count()) > 0) {
    await priceInput.fill('15')
  }

  // Ensure it is active (defaults may vary)
  const isActive = page.getByRole('checkbox', { name: /Is Active/i })
  if ((await isActive.count()) > 0) {
    await isActive.setChecked(true)
  }

  // Ensure card payment method is selected if the field exists
  const paymentMethodsCombobox = page
    .locator('text=Payment Methods')
    .locator('..')
    .locator('[role="combobox"]')
    .first()
  if ((await paymentMethodsCombobox.count()) > 0) {
    await paymentMethodsCombobox.click()
    const cardOption = page.getByRole('option', { name: /card/i })
    if ((await cardOption.count()) > 0) {
      await cardOption.first().click()
    } else {
      // Close the list if it opened without options
      await page.keyboard.press('Escape').catch(() => { })
    }
  }

  await saveObjectAndWaitForNavigation(page, {
    apiPath: '/api/drop-ins',
    expectedUrlPattern: /\/admin\/collections\/drop-ins\/\d+/,
    collectionName: 'drop-ins',
  })

  return dropInName
}

/**
 * Ensure there is a lesson tomorrow whose class option has an Allowed Drop In configured.
 * Returns the Date for tomorrow.
 */
async function ensureLessonForTomorrowWithDropIn(page: any): Promise<Date> {
  const className = `E2E Drop-In Class ${Date.now()}`
  const dropInName = await ensureAtLeastOneDropIn(page)

  // Create a unique class option configured for drop-in payments only
  await page.goto('/admin/collections/class-options', { waitUntil: 'load', timeout: 60000 })
  await page.getByLabel('Create new Class Option').click()

  await page.getByRole('textbox', { name: 'Name *' }).waitFor({ state: 'visible', timeout: 10000 })
  await page.getByRole('textbox', { name: 'Name *' }).fill(className)
  await page.getByRole('spinbutton', { name: 'Places *' }).fill('10')
  await page
    .getByRole('textbox', { name: 'Description *' })
    .fill('A test class option for e2e (drop-in)')

  // Configure payment methods: Allowed Drop In (assumes at least one drop-in exists)
  const allowedDropInCombobox = page
    .locator('text=Allowed Drop In')
    .locator('..')
    .locator('[role="combobox"]')
    .first()

  await expect(allowedDropInCombobox).toBeVisible({ timeout: 20000 })
  await allowedDropInCombobox.click()
  // Scope to the open listbox so we don't accidentally match unrelated "option" roles elsewhere
  const listbox = page.getByRole('listbox')
  const noOptions = listbox.getByText(/No options/i)
  if (await noOptions.isVisible({ timeout: 2000 }).catch(() => false)) {
    throw new Error(
      'No Drop In options were available to select. Ensure a Drop In exists and is accessible in the admin UI.',
    )
  }

  const dropInOption = listbox.getByRole('option', { name: new RegExp(dropInName, 'i') })
  if ((await dropInOption.count()) > 0) {
    await dropInOption.first().click()
  } else {
    // Fallback: select the first available option (better than hanging on "no options")
    const first = listbox.getByRole('option').first()
    await expect(first).toBeVisible({ timeout: 20000 })
    await first.click()
  }

  await saveObjectAndWaitForNavigation(page, {
    apiPath: '/api/class-options',
    expectedUrlPattern: /\/admin\/collections\/class-options\/\d+/,
    collectionName: 'class-options',
  })

  // Compute tomorrow's date (used for lesson creation)
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowDateStr = tomorrow.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  // Create a new lesson for tomorrow using this class option
  await page.goto('/admin/collections/lessons/create', { waitUntil: 'load', timeout: 120000 })

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

  // Verify the selected class option has the required payment method (drop-in)
  await verifyClassOptionPaymentMethod(page, className, 'dropIn')

  // Save lesson with ID extraction fallback
  await saveObjectAndWaitForNavigation(page, {
    apiPath: '/api/lessons',
    expectedUrlPattern: /\/admin\/collections\/lessons\/\d+/,
    collectionName: 'lessons',
  })

  return tomorrow
}

/**
 * Verify that a class option has the required payment method configured.
 * Uses API to check the class option without navigating away from the current page.
 */
async function verifyClassOptionPaymentMethod(
  page: any,
  className: string,
  requiredMethod: 'dropIn' | 'subscription',
): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000'
  const request = page.context().request

  // Find the class option by name via API
  const cookies = await page.context().cookies()
  const classOptionsResponse = await request.get(
    `${baseUrl}/api/class-options?where[name][equals]=${encodeURIComponent(className)}&limit=1`,
    {
      headers: {
        Cookie: cookies
          .map((c: { name: string; value: string }) => `${c.name}=${c.value}`)
          .join('; '),
      },
    },
  )

  if (!classOptionsResponse.ok()) {
    throw new Error(`Failed to fetch class option "${className}": ${classOptionsResponse.status()}`)
  }

  const classOptionsData = await classOptionsResponse.json()
  const classOption = classOptionsData.docs?.[0]

  if (!classOption) {
    throw new Error(`Class option "${className}" not found`)
  }

  // Verify the payment method is configured
  if (requiredMethod === 'dropIn') {
    const allowedDropIn = classOption.paymentMethods?.allowedDropIn
    if (!allowedDropIn || (typeof allowedDropIn === 'object' && allowedDropIn === null)) {
      throw new Error(`Class option "${className}" does not have an Allowed Drop In configured`)
    }
  } else if (requiredMethod === 'subscription') {
    const allowedPlans = classOption.paymentMethods?.allowedPlans
    if (!allowedPlans || !Array.isArray(allowedPlans) || allowedPlans.length === 0) {
      throw new Error(`Class option "${className}" does not have Allowed Plans configured`)
    }
  }
}

/**
 * Verify that a class option has NO payment methods configured.
 * This ensures the lesson can be checked in directly without payment flow.
 * Uses API to check the class option without navigating away from the current page.
 */
async function verifyClassOptionHasNoPaymentMethods(
  page: any,
  className: string,
): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000'
  const request = page.context().request

  // Find the class option by name via API
  const cookies = await page.context().cookies()
  const classOptionsResponse = await request.get(
    `${baseUrl}/api/class-options?where[name][equals]=${encodeURIComponent(className)}&limit=1`,
    {
      headers: {
        Cookie: cookies
          .map((c: { name: string; value: string }) => `${c.name}=${c.value}`)
          .join('; '),
      },
    },
  )

  if (!classOptionsResponse.ok()) {
    throw new Error(`Failed to fetch class option "${className}": ${classOptionsResponse.status()}`)
  }

  const classOptionsData = await classOptionsResponse.json()
  const classOption = classOptionsData.docs?.[0]

  if (!classOption) {
    throw new Error(`Class option "${className}" not found`)
  }

  // Verify NO payment methods are configured
  const paymentMethods = classOption.paymentMethods

  // Check if allowedDropIn is configured
  // allowedDropIn can be: number (ID), DropIn object, null (explicitly no drop-in), or undefined (not set)
  // If it's a number or object, it means a drop-in is configured
  const hasDropIn = paymentMethods?.allowedDropIn != null &&
    paymentMethods.allowedDropIn !== null &&
    (typeof paymentMethods.allowedDropIn === 'number' || typeof paymentMethods.allowedDropIn === 'object')

  // Check if allowedPlans is configured
  // allowedPlans can be: array of numbers/Plans, null (explicitly no plans), or undefined (not set)
  // If it's an array with items, it means plans are configured
  const hasPlans = paymentMethods?.allowedPlans != null &&
    paymentMethods.allowedPlans !== null &&
    Array.isArray(paymentMethods.allowedPlans) &&
    paymentMethods.allowedPlans.length > 0

  if (hasDropIn || hasPlans) {
    const methods = []
    if (hasDropIn) methods.push('Drop In')
    if (hasPlans) methods.push('Subscription/Plans')
    throw new Error(
      `Class option "${className}" has payment methods configured (${methods.join(', ')}) but should have none. ` +
      `This test requires a lesson that can be checked in directly without payment.`
    )
  }
}


test.describe('User booking flow from schedule', () => {
  // CI dev server recompiles are slow; allow more time
  test.setTimeout(180000)

  test('user can check in and then cancel tomorrow’s lesson', async ({ page }) => {
    // Admin phase: ensure prerequisites
    await ensureAdminLoggedIn(page)
    await ensureHomePageWithSchedule(page)
    const tomorrow = await ensureLessonForTomorrow(page)

    // Verify the class option has NO payment methods configured
    // This ensures the lesson can be checked in directly without payment flow
    await verifyClassOptionHasNoPaymentMethods(page, 'E2E Test Class')

    // Log out admin
    await page.goto('/admin/logout', { waitUntil: 'load' }).catch(() => { })
    // Clear cookies to ensure we're logged out
    await page.context().clearCookies()
    await page.waitForTimeout(1000)
    // Warm server again for public page load (Next dev re-compiles in CI)
    await waitForServerReady(page.context().request)

    // User phase: navigate to home (has schedule) and view schedule
    await page.goto('/', { waitUntil: 'load', timeout: 60000 })
    await expect(page.locator('#schedule')).toBeVisible()
    await expect(page.getByRole('heading', { name: /Schedule/i })).toBeVisible()

    await goToTomorrowInSchedule(page)

    // Find the specific lesson by class name to ensure we click the correct one
    // The lesson we created has class name "E2E Test Class" and time 10:00 AM - 11:00 AM
    // This ensures we're clicking on the lesson we created, not another lesson on the schedule

    // Find the lesson card by locating the class name, then finding its parent container
    // The structure is: container > div (details) > div.text-xl.font-medium (class name)
    const classNameElement = page
      .locator('#schedule')
      .locator('div.text-xl.font-medium', { hasText: 'E2E Test Class' })
      .first()

    await expect(classNameElement).toBeVisible({ timeout: 60000 })

    // Verify the time matches (10:00 AM - 11:00 AM) to ensure it's the correct lesson
    const timeElement = classNameElement
      .locator('..') // Go to parent (details div)
      .locator('div.text-sm.font-light', { hasText: /10:00.*AM.*11:00.*AM/i })
      .first()
    await expect(timeElement).toBeVisible({ timeout: 10000 })

    // Navigate to the lesson card container (parent of the details div)
    const lessonCard = classNameElement.locator('../..').first()

    // Within this specific lesson card, find the "Book" or "Check In" button
    // Button text is "Book" for active lessons without payment methods
    const checkInButtonAfterCancel = lessonCard
      .getByRole('button', { name: /^(Book|Check In)$/i })
      .first()
    await expect(checkInButtonAfterCancel).toBeVisible({ timeout: 60000 })

    // Set up navigation promise BEFORE clicking (critical for UI mode)
    const completeBookingNavPromise = page.waitForURL(/\/complete-booking/, {
      timeout: process.env.CI ? 60000 : 30000,
      waitUntil: 'load',
    })

    // Click the button and wait for navigation
    await Promise.all([
      checkInButtonAfterCancel.click(),
      // Don't await navigation yet
    ])

    await page.waitForTimeout(6000)

    // Wait for navigation to complete-booking page (with a longer timeout)
    const reachedComplete = await completeBookingNavPromise.then(() => true).catch(() => false)

    if (!reachedComplete) {
      await page.waitForTimeout(6000)
      const completeHeadingVisible = await page
        .getByRole('heading', { name: /complete.*booking/i })
        .isVisible({ timeout: 5000 })
        .catch(() => false)
      if (!completeHeadingVisible) {
        throw new Error('Did not reach complete-booking page after clicking Check In')
      }
    }

    const callbackPath = (() => {
      try {
        const current = new URL(page.url())
        const rawCallback = current.searchParams.get('callbackUrl')
        if (rawCallback) {
          return rawCallback.startsWith('http') ? new URL(rawCallback).pathname : rawCallback
        }
      } catch {
        // ignore parsing errors and fall back
      }
      return '/'
    })()

    // If there's a login tab, use it; otherwise assume login mode is default
    const registerTab = page.getByRole('tab', { name: /Register/i })
    if ((await registerTab.count()) > 0) {
      await registerTab.click()
    }

    await page.waitForTimeout(5000)

    // Submit email to request magic link
    const nameInput = page.getByRole('textbox', { name: /Name/i })
    await expect(nameInput).toBeVisible({ timeout: process.env.CI ? 30000 : 10000 })
    await nameInput.fill('John Doe')
    const emailInput = page.getByRole('textbox', { name: /Email/i })
    await expect(emailInput).toBeVisible({ timeout: 10000 })
    const email = `user-${Date.now()}@example.com`
    await emailInput.fill(email)
    await clearTestMagicLinks(page.context().request, email)

    const submitButton = page.getByRole('button', { name: 'Submit' })
    await expect(submitButton).toBeVisible({ timeout: 10000 })
    // Ensure button is actionable (critical for UI mode)
    await expect(submitButton)
      .toBeEnabled({ timeout: 10000 })
      .catch(() => {
        return page.waitForTimeout(1000)
      })

    // Set up navigation promise BEFORE clicking (critical for UI mode)
    const magicLinkSentNavPromise = page.waitForURL(/\/magic-link-sent/, {
      timeout: process.env.CI ? 120000 : 90000,
    })

    // Click submit and wait for navigation
    await Promise.all([magicLinkSentNavPromise, submitButton.click()])

    // Verify we're on the magic link sent page
    await expect(page).toHaveURL(/\/magic-link-sent/)
    // Use a specific heading locator to avoid strict-mode ambiguity with live region text
    await expect(page.getByRole('heading', { name: /Magic link sent/i })).toBeVisible({
      timeout: 10000,
    })

    // Retrieve magic link via test-only endpoint and follow it
    const magicLink = await pollForTestMagicLink(page.context().request, email, 15, 1000)
    await page.goto(magicLink.url, { waitUntil: 'load', timeout: 60000 })

    const landedOnCallback = await page
      .waitForURL(
        (url) => {
          try {
            return url.pathname.startsWith(callbackPath)
          } catch {
            return false
          }
        },
        { timeout: 10000 },
      )
      .then(() => true)
      .catch(() => false)

    if (!landedOnCallback) {
      // Callback routes often redirect immediately; don't wait for full `load` (can hang in CI)
      await page.goto(callbackPath, { waitUntil: 'domcontentloaded', timeout: 30000 })
    }

    // Wait for callback path or dashboard (booking page may redirect post-login).
    // If we don't get either fairly quickly, fail fast with a clear message rather than
    // attempting extra navigation after the test timeout (which causes "page closed" errors in CI).
    const normalizedCallbackPath =
      callbackPath && callbackPath.startsWith('/') ? callbackPath : `/${callbackPath || ''}`
    const hasSpecificCallback = normalizedCallbackPath !== '/'

    const redirected = await page
      .waitForURL(
        (url) =>
          url.pathname === '/dashboard' ||
          (hasSpecificCallback && url.pathname.startsWith(normalizedCallbackPath)),
        { timeout: 60000 },
      )
      .then(() => true)
      .catch(() => false)

    if (!redirected) {
      throw new Error(
        `Did not redirect to callback (${callbackPath}) or /dashboard after magic link`,
      )
    }

    // The auth callback often lands on the booking page; the rest of this test expects dashboard.
    const afterMagicLinkPathname = (() => {
      try {
        return new URL(page.url()).pathname
      } catch {
        return ''
      }
    })()

    if (afterMagicLinkPathname !== '/dashboard') {
      await page.goto('/dashboard', { waitUntil: 'domcontentloaded', timeout: 60000 })
    }

    // Verify the booking shows as cancelable on the schedule for tomorrow
    // The schedule is on the dashboard - navigate there if we're not already
    const currentUrl = page.url()


    // Wait for dashboard to fully load and verify we're authenticated
    // If not authenticated, dashboard will redirect to /auth/sign-in
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => { })
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })

    // Verify session is established by checking for user name on dashboard
    // Dashboard shows "Welcome {user?.name}" - if we see this, user is authenticated
    await expect(page.getByText(/Welcome/i)).toBeVisible({ timeout: 10000 })

    // Reload the page to ensure all client-side queries (including schedule) run with authenticated session
    // This ensures tRPC queries include the session cookies and bookingStatus is calculated correctly
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })

    // Verify we're still authenticated after reload
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })
    await expect(page.getByText(/Welcome/i)).toBeVisible({ timeout: 10000 })

    // Wait for schedule to render
    const scheduleLocator = page.locator('#schedule')
    const scheduleHeading = page.getByRole('heading', { name: /Schedule/i })

    await expect(scheduleLocator).toBeVisible({ timeout: 60000 })
    await expect(scheduleHeading).toBeVisible({ timeout: 60000 })

    // Wait for the schedule query to complete with authenticated session
    // Wait for any loading indicators to disappear, indicating the query completed
    const loadingSpinner = scheduleLocator.getByText('Loading schedule...')
    await expect(loadingSpinner).not.toBeVisible({ timeout: 30000 }).catch(() => {
      // Loading spinner might not exist if query is fast, that's okay
    })

    // Additional wait to ensure bookingStatus is calculated with user context
    await page.waitForTimeout(1000)

    await goToTomorrowInSchedule(page)

    // Find the specific lesson by class name to ensure we're checking the correct one
    // The lesson we created has class name "E2E Test Class" and time 10:00 AM - 11:00 AM

    // Find the lesson card by locating the class name, then finding its parent container
    const classNameElementForCancel = page
      .locator('#schedule')
      .locator('div.text-xl.font-medium', { hasText: 'E2E Test Class' })
      .first()

    await expect(classNameElementForCancel).toBeVisible({ timeout: 60000 })

    // Verify the time matches (10:00 AM - 11:00 AM) to ensure it's the correct lesson
    const timeElementForCancel = classNameElementForCancel
      .locator('..') // Go to parent (details div)
      .locator('div.text-sm.font-light', { hasText: /10:00.*AM.*11:00.*AM/i })
      .first()
    await expect(timeElementForCancel).toBeVisible({ timeout: 10000 })

    // Navigate to the lesson card container (parent of the details div)
    const lessonCardForCancel = classNameElementForCancel.locator('../..').first()

    // Within this specific lesson card, find the "Cancel Booking" button
    const cancelButton = lessonCardForCancel
      .getByRole('button', { name: /Cancel Booking/i })
      .first()
    await expect(cancelButton).toBeVisible({ timeout: 20000 })
    // Ensure button is actionable (critical for UI mode)
    await expect(cancelButton)
      .toBeEnabled({ timeout: 10000 })
      .catch(() => {
        return page.waitForTimeout(1000)
      })
    await cancelButton.click()

    // Cancel UX can vary (dialog confirm vs immediate cancel). Handle both:
    // - If auth is missing, the app may open a login modal — fail fast.
    const loginDialog = page.getByRole('dialog').filter({ hasText: /Log in to your account/i })
    await expect(loginDialog).not.toBeVisible({ timeout: 20000 })

    const confirmDialog = page.getByRole('dialog').filter({ hasText: /Are you sure you want to cancel/i })
    const dialogVisible = await confirmDialog.isVisible({ timeout: 1500 }).catch(() => false)
    if (dialogVisible) {
      const confirmButton = confirmDialog.getByRole('button', { name: /^Confirm$/i })
      await expect(confirmButton).toBeVisible({ timeout: 20000 })
      await expect(confirmButton)
        .toBeEnabled({ timeout: 10000 })
        .catch(() => page.waitForTimeout(1000))
      await confirmButton.click()
    }

    // Wait for UI to reflect cancellation on the same lesson card.
    // With the new schedule viewmodel, the button should flip back to Book quickly.
    const successToast = page
      .locator('text=/booking cancelled|cancelled/i')
      .first()
    await successToast.isVisible({ timeout: 10000 }).catch(() => { })

    const cancelButtonAfter = lessonCardForCancel.getByRole('button', { name: /Cancel Booking/i }).first()
    await expect(cancelButtonAfter).not.toBeVisible({ timeout: 20000 }).catch(() => { })

    const bookButtonAfter = lessonCardForCancel
      .getByRole('button', { name: /^(Book|Check In)$/i })
      .first()
    await expect(bookButtonAfter).toBeVisible({ timeout: 20000 })

    await clearTestMagicLinks(page.context().request, email).catch(() => { })
  })

  test('drop-in lesson: after check-in + register/login redirects to /bookings/{id} and shows Drop-in payment element', async ({
    page,
  }) => {
    // Admin phase: ensure prerequisites
    await ensureAdminLoggedIn(page)
    await ensureHomePageWithSchedule(page)
    await ensureLessonForTomorrowWithDropIn(page)

    // Log out admin
    await page.goto('/admin/logout', { waitUntil: 'load' }).catch(() => { })
    await page.context().clearCookies()
    await page.waitForTimeout(1000)
    await waitForServerReady(page.context().request)

    // User phase: navigate to home (has schedule) and view schedule
    await page.goto('/', { waitUntil: 'load', timeout: 60000 })
    await expect(page.locator('#schedule')).toBeVisible()
    await expect(page.getByRole('heading', { name: /Schedule/i })).toBeVisible()

    await goToTomorrowInSchedule(page)

    // Click "Book" for tomorrow's lesson (button text is "Book" for active lessons)
    const checkInButton = page.getByRole('button', { name: /^(Book|Check In)$/i }).first()
    await expect(checkInButton).toBeVisible({ timeout: 60000 })
    // Ensure button is actionable (critical for UI mode)
    await expect(checkInButton)
      .toBeEnabled({ timeout: 10000 })
      .catch(() => {
        return page.waitForTimeout(1000)
      })

    // Set up navigation promise BEFORE clicking (critical for UI mode)
    const completeBookingNavPromise2 = page.waitForURL(/\/complete-booking/, {
      timeout: process.env.CI ? 60000 : 30000,
      waitUntil: 'load',
    })

    await Promise.all([
      checkInButton.click(),
      // Don't await navigation yet
    ])

    // We should be prompted to complete booking / auth with a callbackUrl to /bookings/{id}
    await completeBookingNavPromise2

    const callbackPath = (() => {
      try {
        const current = new URL(page.url())
        const rawCallback = current.searchParams.get('callbackUrl')
        if (rawCallback) {
          return rawCallback.startsWith('http') ? new URL(rawCallback).pathname : rawCallback
        }
      } catch {
        // ignore parsing errors and fall back
      }
      return '/'
    })()
    const callbackPathname = callbackPath.split('?')[0] ?? callbackPath

    if (!/^\/bookings\/\d+/.test(callbackPath)) {
      throw new Error(`Expected callbackUrl to start with /bookings/{id}, got: ${callbackPath}`)
    }
    const lessonIdFromCallback = (() => {
      const match = callbackPath.match(/\/bookings\/(\d+)/)
      if (!match?.[1]) throw new Error(`Could not extract lesson ID from callbackUrl: ${callbackPath}`)
      return parseInt(match[1], 10)
    })()

    // If there's a login tab, use Register; otherwise assume register mode is default
    const registerTab = page.getByRole('tab', { name: /Register/i })
    if ((await registerTab.count()) > 0) {
      await registerTab.click()
    }

    // Submit email to request magic link
    const nameInput = page.getByRole('textbox', { name: /Name/i })
    await expect(nameInput).toBeVisible({ timeout: process.env.CI ? 30000 : 10000 })
    await nameInput.fill('John Doe')
    const emailInput = page.getByRole('textbox', { name: /Email/i })
    await expect(emailInput).toBeVisible({ timeout: 10000 })
    const email = `user-${Date.now()}@example.com`
    await emailInput.fill(email)
    await clearTestMagicLinks(page.context().request, email)

    const submitButton = page.getByRole('button', { name: 'Submit' })
    await expect(submitButton).toBeVisible({ timeout: 10000 })
    // Ensure button is actionable (critical for UI mode)
    await expect(submitButton)
      .toBeEnabled({ timeout: 10000 })
      .catch(() => {
        return page.waitForTimeout(1000)
      })

    // Set up navigation promise BEFORE clicking (critical for UI mode)
    const magicLinkSentNavPromise2 = page.waitForURL(/\/magic-link-sent/, {
      timeout: process.env.CI ? 120000 : 90000,
    })

    await Promise.all([magicLinkSentNavPromise2, submitButton.click()])

    // Retrieve magic link via test-only endpoint and follow it
    const magicLink = await pollForTestMagicLink(page.context().request, email, 15, 1000)
    await page.goto(magicLink.url, { waitUntil: 'load', timeout: 60000 })

    // Confirm we actually land on the booking page (callback)
    await page.waitForURL(
      (url) => {
        try {
          return url.pathname.startsWith(callbackPath) || url.pathname.startsWith('/dashboard')
        } catch {
          return false
        }
      },
      { timeout: 60000 },
    )

    // Booking page should include the Drop-in tab and Stripe PaymentElement
    const dropInTab = page.getByRole('tab', { name: /Drop-?in/i })
    await expect(dropInTab).toBeVisible({ timeout: 20000 })
    await dropInTab.click()

    await page.waitForTimeout(10000)

    // Wait for the payment element container to appear
    const paymentElement = page.locator('#payment-element')
    await expect(paymentElement).toBeAttached({ timeout: process.env.CI ? 60000 : 30000 })

    // Extract lesson ID from the booking page URL
    const bookingPageUrl = page.url()
    const lessonIdMatch = bookingPageUrl.match(/\/bookings\/(\d+)/)
    if (!lessonIdMatch || !lessonIdMatch[1]) {
      throw new Error(`Could not extract lesson ID from URL: ${bookingPageUrl}`)
    }
    const lessonId = parseInt(lessonIdMatch[1], 10)

    // Mock the payment intent succeeded webhook to confirm the booking
    await mockPaymentIntentSucceededWebhook(page.context().request, {
      lessonId,
      userEmail: email,
    })

    // Wait a moment for webhook to process
    await page.waitForTimeout(1000)

    // Navigate to dashboard and handle potential redirects
    const navigationPromise = page.waitForURL(
      (url) => url.pathname === '/dashboard' || url.pathname.includes('/auth/sign-in'),
      { timeout: 60000 }
    )

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded', timeout: 60000 })
    await navigationPromise

    // Check if we were redirected to sign-in
    const currentUrl = page.url()
    if (currentUrl.includes('/auth/sign-in')) {
      // Session was lost - verify by checking if we can see login form
      const loginForm = page.getByRole('textbox', { name: /email/i })
      const hasLoginForm = await loginForm.isVisible({ timeout: 5000 }).catch(() => false)

      if (hasLoginForm) {
        throw new Error(
          `Session was lost after webhook mock. Redirected to sign-in instead of dashboard. ` +
          `This suggests the session cookie was not preserved or was invalidated. ` +
          `Current URL: ${currentUrl}`
        )
      }
    }

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })

    // Wait for dashboard to fully load
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => { })

    // Verify session is established by checking for user name on dashboard
    // Dashboard shows "Welcome {user?.name}" - if we see this, user is authenticated
    await expect(page.getByText(/Welcome/i)).toBeVisible({ timeout: 10000 })

    // Reload the page to ensure all client-side queries (including schedule) run with authenticated session
    // This ensures tRPC queries include the session cookies and bookingStatus is calculated correctly
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })

    // Verify we're still authenticated after reload
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })
    await expect(page.getByText(/Welcome/i)).toBeVisible({ timeout: 10000 })

    // Wait for the schedule to load
    const scheduleLocator = page.locator('#schedule')
    const scheduleHeading = page.getByRole('heading', { name: /Schedule/i })
    await expect(scheduleLocator).toBeVisible({ timeout: 60000 })
    await expect(scheduleHeading).toBeVisible({ timeout: 60000 })

    // Wait for the schedule query to complete with authenticated session
    // Wait for any loading indicators to disappear, indicating the query completed
    const loadingSpinner = scheduleLocator.getByText('Loading schedule...')
    await expect(loadingSpinner).not.toBeVisible({ timeout: 30000 }).catch(() => {
      // Loading spinner might not exist if query is fast, that's okay
    })

    // Additional wait to ensure bookingStatus is calculated with user context
    await page.waitForTimeout(1000)

    // Navigate to tomorrow in the schedule
    await goToTomorrowInSchedule(page)

    // Verify the lesson is booked - should show "Cancel Booking" button instead of "Book"
    const cancelButton = page.getByRole('button', { name: /Cancel Booking/i }).first()
    await expect(cancelButton).toBeVisible({ timeout: 20000 })

    // Verify the lesson class name contains "drop in"
    // The class name is in a div with class "text-xl font-medium" that's a sibling of the button's parent
    const lessonContainer = cancelButton.locator('..').locator('..') // Go up to the outer container
    const classNameElement = lessonContainer.locator('div.text-xl.font-medium').first()
    await expect(classNameElement).toBeVisible({ timeout: 5000 })
    const className = await classNameElement.textContent()
    expect(className).toMatch(/drop.?in/i)

    await clearTestMagicLinks(page.context().request, email).catch(() => { })
  })

  test('subscription lesson: after check-in + register/login, subscribe returns redirect URL and subscription webhook confirms booking', async ({
    page,
  }) => {
    // Admin phase: ensure prerequisites
    await ensureAdminLoggedIn(page)
    await ensureHomePageWithSchedule(page)
    await ensureLessonForTomorrowWithSubscription(page)

    // Log out admin
    await page.goto('/admin/logout', { waitUntil: 'load' }).catch(() => { })
    await page.context().clearCookies()
    await page.waitForTimeout(1000)
    await waitForServerReady(page.context().request)

    // User phase: navigate to home (has schedule) and view schedule
    await page.goto('/', { waitUntil: 'load', timeout: 60000 })
    await expect(page.locator('#schedule')).toBeVisible()
    await expect(page.getByRole('heading', { name: /Schedule/i })).toBeVisible()

    await goToTomorrowInSchedule(page)

    // Click "Book" for tomorrow's lesson (button text is "Book" for active lessons)
    const checkInButton = page.getByRole('button', { name: /^(Book|Check In)$/i }).first()
    await expect(checkInButton).toBeVisible({ timeout: 60000 })
    await expect(checkInButton)
      .toBeEnabled({ timeout: 10000 })
      .catch(() => {
        return page.waitForTimeout(1000)
      })

    // Set up navigation promise BEFORE clicking (critical for UI mode)
    const completeBookingNavPromise = page.waitForURL(/\/complete-booking/, {
      timeout: process.env.CI ? 60000 : 30000,
      waitUntil: 'load',
    })

    await Promise.all([
      checkInButton.click(),
      // Don't await navigation yet
    ])

    await completeBookingNavPromise

    const callbackPath = (() => {
      try {
        const current = new URL(page.url())
        const rawCallback = current.searchParams.get('callbackUrl')
        if (rawCallback) {
          return rawCallback.startsWith('http') ? new URL(rawCallback).pathname : rawCallback
        }
      } catch {
        // ignore parsing errors and fall back
      }
      return '/'
    })()
    const callbackPathname = callbackPath.split('?')[0] ?? callbackPath

    if (!/^\/bookings\/\d+/.test(callbackPath)) {
      throw new Error(`Expected callbackUrl to start with /bookings/{id}, got: ${callbackPath}`)
    }
    const lessonIdFromCallback = (() => {
      const match = callbackPath.match(/\/bookings\/(\d+)/)
      if (!match?.[1]) throw new Error(`Could not extract lesson ID from callbackUrl: ${callbackPath}`)
      return parseInt(match[1], 10)
    })()

    // If there's a login tab, use Register; otherwise assume register mode is default
    const registerTab = page.getByRole('tab', { name: /Register/i })
    if ((await registerTab.count()) > 0) {
      await registerTab.click()
    }

    // Submit email to request magic link
    const nameInput = page.getByRole('textbox', { name: /Name/i })
    await expect(nameInput).toBeVisible({ timeout: process.env.CI ? 30000 : 10000 })
    await nameInput.fill('John Doe')
    const emailInput = page.getByRole('textbox', { name: /Email/i })
    await expect(emailInput).toBeVisible({ timeout: 10000 })
    const email = `user-${Date.now()}@example.com`
    await emailInput.fill(email)
    await clearTestMagicLinks(page.context().request, email)

    const submitButton = page.getByRole('button', { name: 'Submit' })
    await expect(submitButton).toBeVisible({ timeout: 10000 })
    await expect(submitButton)
      .toBeEnabled({ timeout: 10000 })
      .catch(() => {
        return page.waitForTimeout(1000)
      })

    const magicLinkSentNavPromise = page.waitForURL(/\/magic-link-sent/, {
      timeout: process.env.CI ? 120000 : 90000,
    })

    await Promise.all([magicLinkSentNavPromise, submitButton.click()])

    const magicLink = await pollForTestMagicLink(page.context().request, email, 15, 1000)
    await page.goto(magicLink.url, { waitUntil: 'load', timeout: 60000 })

    await page.waitForURL(
      (url) => {
        try {
          return url.pathname.startsWith(callbackPathname) || url.pathname.startsWith('/dashboard')
        } catch {
          return false
        }
      },
      { timeout: 60000 },
    )

    // If auth flow landed on /dashboard, explicitly navigate back to the booking callback.
    // This keeps the test deterministic and avoids relying on app-specific post-login redirects.
    try {
      const current = new URL(page.url())
      if (!current.pathname.startsWith(callbackPathname)) {
        await page.goto(callbackPath, { waitUntil: 'load', timeout: 60000 })
      }
    } catch {
      await page.goto(callbackPath, { waitUntil: 'load', timeout: 60000 })
    }

    // On booking page, open Subscription tab and click Subscribe
    // (UI label is "Subscription"; older tests referenced "Membership")
    const subscriptionTab = page.getByRole('tab', { name: /Membership/i })
    await expect(subscriptionTab).toBeVisible({ timeout: 20000 })
    await subscriptionTab.click()

    const subscribeButton = page.getByRole('button', { name: /Subscribe/i }).first()
    await expect(subscribeButton).toBeVisible({ timeout: 20000 })
    await expect(subscribeButton)
      .toBeEnabled({ timeout: 10000 })
      .catch(() => page.waitForTimeout(1000))

    // Subscribe uses tRPC (payments.createCustomerCheckoutSession), not /api/stripe/create-checkout-session.
    // Set up the wait BEFORE clicking (Playwright best practice).
    const checkoutResponsePromise = page.waitForResponse(
      (res) =>
        res.url().includes('/api/trpc/payments.createCustomerCheckoutSession') &&
        res.request().method() === 'POST',
      { timeout: process.env.CI ? 30000 : 10000 },
    )

    // In CI/test mode the app may immediately navigate away (router.push), which can abort the response
    // body stream and make `response.json()` flaky. Assert the observable behavior instead.
    await Promise.all([checkoutResponsePromise, subscribeButton.click()])
    await expect(page).toHaveURL(/\/dashboard/, { timeout: process.env.CI ? 60000 : 30000 })

    // Wait for page to fully load
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => { })

    // Verify we're on dashboard before webhook
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })

    // Mock subscription created webhook to confirm booking
    await mockSubscriptionCreatedWebhook(page.context().request, {
      lessonId: lessonIdFromCallback,
      userEmail: email,
    })

    // Wait a moment for webhook to process and any side effects to complete
    await page.waitForTimeout(2000)

    // Verify we're still on dashboard after webhook (session should be preserved)
    // Check current URL without navigating (we should already be on dashboard)
    const currentUrl = page.url()

    // If we were redirected to sign-in, the session was lost
    if (currentUrl.includes('/auth/sign-in')) {
      throw new Error(
        `Session was lost after webhook mock. Redirected to sign-in instead of dashboard. ` +
        `This suggests the session cookie was not preserved or was invalidated. ` +
        `Current URL: ${currentUrl}. ` +
        `This might be a timing issue - the webhook may have triggered a redirect.`
      )
    }

    // If we're not on dashboard, navigate there (shouldn't happen, but handle it)
    if (!currentUrl.includes('/dashboard')) {
      const navigationPromise = page.waitForURL(
        (url) => url.pathname === '/dashboard' || url.pathname.includes('/auth/sign-in'),
        { timeout: 60000 }
      )
      await page.goto('/dashboard', { waitUntil: 'domcontentloaded', timeout: 60000 })
      await navigationPromise

      // Check if navigation redirected to sign-in
      if (page.url().includes('/auth/sign-in')) {
        throw new Error(
          `Session was lost. Could not navigate to dashboard - redirected to sign-in. ` +
          `Current URL: ${page.url()}`
        )
      }

      await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })
    } else {
      // We're already on dashboard - just verify
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })
    }

    // Wait for dashboard to fully load
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => { })

    // Verify session is established by checking for user name on dashboard
    // Dashboard shows "Welcome {user?.name}" - if we see this, user is authenticated
    await expect(page.getByText(/Welcome/i)).toBeVisible({ timeout: 10000 })

    // Reload the page to ensure all client-side queries (including schedule) run with authenticated session
    // This ensures tRPC queries include the session cookies and bookingStatus is calculated correctly
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })

    // Verify we're still authenticated after reload
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })
    await expect(page.getByText(/Welcome/i)).toBeVisible({ timeout: 10000 })

    const scheduleLocator = page.locator('#schedule')
    const scheduleHeading = page.getByRole('heading', { name: /Schedule/i })
    await expect(scheduleLocator).toBeVisible({ timeout: 60000 })
    await expect(scheduleHeading).toBeVisible({ timeout: 60000 })

    // Wait for the schedule query to complete with authenticated session
    // Wait for any loading indicators to disappear, indicating the query completed
    const loadingSpinner = scheduleLocator.getByText('Loading schedule...')
    await expect(loadingSpinner).not.toBeVisible({ timeout: 30000 }).catch(() => {
      // Loading spinner might not exist if query is fast, that's okay
    })

    // Additional wait to ensure bookingStatus is calculated with user context
    await page.waitForTimeout(1000)

    await goToTomorrowInSchedule(page)

    const cancelButton = page.getByRole('button', { name: /Cancel Booking/i }).first()
    await expect(cancelButton).toBeVisible({ timeout: 20000 })

    await clearTestMagicLinks(page.context().request, email).catch(() => { })
  })
})
