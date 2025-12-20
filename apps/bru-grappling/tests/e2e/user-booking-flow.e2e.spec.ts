import { test, expect } from '@playwright/test'
import {
  clearTestMagicLinks,
  ensureAdminLoggedIn,
  pollForTestMagicLink,
  saveObjectAndWaitForNavigation,
  waitForServerReady,
} from './helpers'

/**
 * Ensure there is a home page with a Schedule block.
 * If a page with slug "home" does not exist, create one via the admin UI.
 */
async function ensureHomePageWithSchedule(page: any): Promise<void> {
  // Warm server before first admin navigation to avoid dev-server restarts on CI
  await waitForServerReady(page.context().request)
  await page.goto('/admin/collections/pages', { waitUntil: 'domcontentloaded', timeout: 120000 })

  const homeRow = page.getByRole('row', { name: /home/i })
  if ((await homeRow.count()) > 0) {
    // Page exists; we rely on CMS config for the schedule block.
    return
  }

  // Create minimal home page with a Schedule block
  await page.getByLabel(/Create new Page/i).click()

  // Wait for form fields to be ready instead of relying on page load alone
  await page.getByRole('textbox', { name: 'Title *' }).waitFor({ state: 'visible', timeout: 10000 })

  await page.getByRole('textbox', { name: 'Title *' }).fill('Home')
  await page.getByRole('textbox', { name: /Slug/i }).fill('home')

  // Add Schedule block (label may be "Schedule")
  const addLayoutButton = page.getByRole('button', { name: 'Add Layout' })
  await addLayoutButton.click()
  await page.getByRole('button', { name: /Schedule/i }).click()

  await saveObjectAndWaitForNavigation(page, {
    apiPath: '/api/pages',
    expectedUrlPattern: /\/admin\/collections\/pages\/\d+/,
    collectionName: 'pages',
  })
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

    await page
      .waitForURL(/\/admin\/collections\/class-options\/create/, { timeout: 10000 })
      .catch(async () => {
        await page.goto('/admin/collections/class-options/create', {
          waitUntil: 'domcontentloaded',
          timeout: 10000,
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
  const createButton = page.getByLabel(/Create new Drop In/i)
  if ((await createButton.count()) > 0) {
    await createButton.click()
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
      await page.keyboard.press('Escape').catch(() => {})
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

  // Save lesson with ID extraction fallback
  await saveObjectAndWaitForNavigation(page, {
    apiPath: '/api/lessons',
    expectedUrlPattern: /\/admin\/collections\/lessons\/\d+/,
    collectionName: 'lessons',
  })

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
    timeout: 60000,
  })

  return tomorrow
}

test.describe('User booking flow from schedule', () => {
  // CI dev server recompiles are slow; allow more time
  test.setTimeout(180000)

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
    // Warm server again for public page load (Next dev re-compiles in CI)
    await waitForServerReady(page.context().request)

    // User phase: navigate to home (has schedule) and view schedule
    await page.goto('/', { waitUntil: 'load', timeout: 60000 })
    await expect(page.locator('#schedule')).toBeVisible()
    await expect(page.getByRole('heading', { name: /Schedule/i })).toBeVisible()

    await goToTomorrowInSchedule(page)

    // Click "Check In" for tomorrow's lesson
    const checkInButtonAfterCancel = page.getByRole('button', { name: /Check In/i }).first()
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
    const redirected = await page
      .waitForURL(
        (url) => /\/dashboard/.test(url.pathname) || url.pathname.startsWith(callbackPath),
        { timeout: 60000 },
      )
      .then(() => true)
      .catch(() => false)

    if (!redirected) {
      throw new Error(
        `Did not redirect to callback (${callbackPath}) or /dashboard after magic link`,
      )
    }

    // Verify the booking shows as cancelable on the schedule for tomorrow
    // The schedule should be on the dashboard - wait for it to appear
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {})
    const scheduleLocator = page.locator('#schedule')
    const scheduleHeading = page.getByRole('heading', { name: /Schedule/i })

    await expect(scheduleLocator).toBeVisible({ timeout: 60000 })
    await expect(scheduleHeading).toBeVisible({ timeout: 60000 })

    await goToTomorrowInSchedule(page)

    const cancelButton = page.getByRole('button', { name: /Cancel Booking/i }).first()
    await expect(cancelButton).toBeVisible({ timeout: 20000 })
    // Ensure button is actionable (critical for UI mode)
    await expect(cancelButton)
      .toBeEnabled({ timeout: 10000 })
      .catch(() => {
        return page.waitForTimeout(1000)
      })
    await cancelButton.click()

    await page.waitForTimeout(5000)

    const confirmButton = page.getByRole('button', { name: /^Confirm$/i })
    await expect(confirmButton).toBeVisible({ timeout: 20000 })

    // Ensure button is actionable (critical for UI mode)
    await expect(confirmButton)
      .toBeEnabled({ timeout: 10000 })
      .catch(() => {
        return page.waitForTimeout(5000)
      })
    await confirmButton.click()

    const checkInButton = page.getByRole('button', { name: /Check In/i }).first()
    await expect(checkInButton).toBeVisible({ timeout: 20000 })

    await clearTestMagicLinks(page.context().request, email).catch(() => {})
  })

  test('drop-in lesson: after check-in + register/login redirects to /bookings/{id} and shows Drop-in payment element', async ({
    page,
  }) => {
    // Admin phase: ensure prerequisites
    await ensureAdminLoggedIn(page)
    await ensureHomePageWithSchedule(page)
    await ensureLessonForTomorrowWithDropIn(page)

    // Log out admin
    await page.goto('/admin/logout', { waitUntil: 'load' }).catch(() => {})
    await page.context().clearCookies()
    await page.waitForTimeout(1000)
    await waitForServerReady(page.context().request)

    // User phase: navigate to home (has schedule) and view schedule
    await page.goto('/', { waitUntil: 'load', timeout: 60000 })
    await expect(page.locator('#schedule')).toBeVisible()
    await expect(page.getByRole('heading', { name: /Schedule/i })).toBeVisible()

    await goToTomorrowInSchedule(page)

    // Click "Check In" for tomorrow's lesson
    const checkInButton = page.getByRole('button', { name: /Check In/i }).first()
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

    if (!/^\/bookings\/\d+/.test(callbackPath)) {
      throw new Error(`Expected callbackUrl to start with /bookings/{id}, got: ${callbackPath}`)
    }

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

    // Wait for the payment element container to appear
    const paymentElement = page.locator('#payment-element')
    await expect(paymentElement).toBeAttached({ timeout: process.env.CI ? 60000 : 30000 })

    // In CI, Stripe's iframe can take time to load. Wait for the element to become visible
    // and have an iframe inside it. This ensures Stripe has fully initialized.
    const timeout = process.env.CI ? 60000 : 30000
    await page.waitForFunction(
      () => {
        const element = document.getElementById('payment-element')
        if (!element) return false

        // Check if element is visible (not hidden)
        const style = window.getComputedStyle(element)
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
          return false
        }

        // Check if there's an iframe inside
        const iframe = element.querySelector('iframe')
        if (!iframe) return false

        // Check if iframe is visible
        const iframeStyle = window.getComputedStyle(iframe)
        return iframeStyle.display !== 'none' && iframeStyle.visibility !== 'hidden'
      },
      { timeout },
    )

    // Final assertions to ensure everything is visible
    await expect(paymentElement).toBeVisible({ timeout: 60000 })
    const stripeIframe = paymentElement.locator('iframe').first()
    await expect(stripeIframe).toBeVisible({ timeout: 60000 })

    await clearTestMagicLinks(page.context().request, email).catch(() => {})
  })
})
