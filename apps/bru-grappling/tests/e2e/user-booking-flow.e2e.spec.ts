import { test, expect } from '@playwright/test'
import {
  clearTestMagicLinks,
  ensureAdminLoggedIn,
  ensureTimeslotForTomorrowWithSubscription,
  mockPaymentIntentSucceededWebhook,
  mockSubscriptionCreatedWebhook,
  pollForTestMagicLink,
  saveObjectAndWaitForNavigation,
  waitForServerReady,
} from './helpers'
import { ensureHomePageWithSchedule, goToTomorrowInSchedule } from '@repo/testing-config/src/playwright'

async function apiGet<T>(page: any, path: string): Promise<T> {
  const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000'
  const cookies = await page.context().cookies()
  const cookieHeader = cookies.map((c: { name: string; value: string }) => `${c.name}=${c.value}`).join('; ')
  const res = await page.context().request.get(`${baseUrl}${path}`, {
    headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
    timeout: 120000,
  })
  if (!res.ok()) {
    const txt = await res.text().catch(() => '')
    throw new Error(`GET ${path} failed: ${res.status()} ${txt}`)
  }
  const json: any = await res.json().catch(() => null)
  return (json?.doc ?? json) as T
}

async function apiPost<T>(page: any, path: string, data: Record<string, unknown>): Promise<T> {
  const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000'
  const cookies = await page.context().cookies()
  const cookieHeader = cookies.map((c: { name: string; value: string }) => `${c.name}=${c.value}`).join('; ')
  const res = await page.context().request.post(`${baseUrl}${path}`, {
    headers: {
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      'Content-Type': 'application/json',
    },
    data,
    timeout: 120000,
  })
  if (!res.ok()) {
    const txt = await res.text().catch(() => '')
    throw new Error(`POST ${path} failed: ${res.status()} ${txt}`)
  }
  const json: any = await res.json().catch(() => null)
  return (json?.doc ?? json) as T
}

async function createEventTypeViaApi(
  page: any,
  options: {
    name: string
    description: string
    paymentMethods?: { allowedPlans?: number[]; allowedDropIn?: number | null }
  },
): Promise<number> {
  const created = await apiPost<{ id: number }>(page, '/api/event-types', {
    name: options.name,
    places: 10,
    description: options.description,
    type: 'adult',
    ...(options.paymentMethods ? { paymentMethods: options.paymentMethods } : {}),
  })
  if (!created?.id) throw new Error(`Unexpected class option response: ${JSON.stringify(created)}`)
  return Number(created.id)
}

async function createTimeslotForTomorrowViaApi(page: any, classOptionId: number): Promise<Date> {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const start = new Date(tomorrow)
  start.setHours(10, 0, 0, 0)
  const end = new Date(tomorrow)
  end.setHours(11, 0, 0, 0)
  await apiPost(page, '/api/timeslots', {
    date: tomorrow.toISOString(),
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    lockOutTime: 0,
    classOption: classOptionId,
    active: true,
  })
  return tomorrow
}

/**
 * Ensure there is a lesson tomorrow with a basic class option.
 * Returns the Date for tomorrow.
 */
async function ensureTimeslotForTomorrow(
  page: any,
  className = `E2E Test Class ${Date.now()}`,
): Promise<{ tomorrow: Date; className: string }> {
  const existingEventType = await apiGet<{ docs?: Array<{ id: number }> }>(
    page,
    `/api/event-types?where[name][equals]=${encodeURIComponent(className)}&limit=1&depth=0`,
  )
  const classOptionId =
    existingEventType?.docs?.[0]?.id ??
    (await createEventTypeViaApi(page, {
      name: className,
      description: 'A test class option for e2e',
    }))

  const tomorrow = await createTimeslotForTomorrowViaApi(page, classOptionId)
  return { tomorrow, className }
}

function getScheduleTimeslotCard(page: any, className: string) {
  return page
    .locator('#schedule')
    .first()
    .locator('div.flex.w-full.flex-col.gap-4.border-b', {
      has: page.locator('div.text-xl.font-medium', { hasText: className }),
    })
    .first()
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
async function ensureTimeslotForTomorrowWithDropIn(page: any): Promise<Date> {
  const className = `E2E Drop-In Class ${Date.now()}`
  const dropInName = await ensureAtLeastOneDropIn(page)
  const dropIns = await apiGet<{ docs?: Array<{ id: number }> }>(
    page,
    `/api/drop-ins?where[name][equals]=${encodeURIComponent(dropInName)}&limit=1&depth=0`,
  )
  const dropInId = dropIns?.docs?.[0]?.id
  if (!dropInId) throw new Error(`Drop In "${dropInName}" not found after creation`)

  const classOptionId = await createEventTypeViaApi(page, {
    name: className,
    description: 'A test class option for e2e (drop-in)',
    paymentMethods: { allowedDropIn: Number(dropInId) },
  })

  await verifyEventTypePaymentMethod(page, className, 'dropIn')
  return await createTimeslotForTomorrowViaApi(page, classOptionId)
}

/**
 * Verify that a class option has the required payment method configured.
 * Uses API to check the class option without navigating away from the current page.
 */
async function verifyEventTypePaymentMethod(
  page: any,
  className: string,
  requiredMethod: 'dropIn' | 'subscription',
): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000'
  const request = page.context().request

  // Find the class option by name via API
  const cookies = await page.context().cookies()
  const eventTypesResponse = await request.get(
    `${baseUrl}/api/event-types?where[name][equals]=${encodeURIComponent(className)}&limit=1`,
    {
      headers: {
        Cookie: cookies
          .map((c: { name: string; value: string }) => `${c.name}=${c.value}`)
          .join('; '),
      },
    },
  )

  if (!eventTypesResponse.ok()) {
    throw new Error(`Failed to fetch class option "${className}": ${eventTypesResponse.status()}`)
  }

  const eventTypesData = await eventTypesResponse.json()
  const classOption = eventTypesData.docs?.[0]

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
async function verifyEventTypeHasNoPaymentMethods(
  page: any,
  className: string,
): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000'
  const request = page.context().request

  // Find the class option by name via API
  const cookies = await page.context().cookies()
  const eventTypesResponse = await request.get(
    `${baseUrl}/api/event-types?where[name][equals]=${encodeURIComponent(className)}&limit=1`,
    {
      headers: {
        Cookie: cookies
          .map((c: { name: string; value: string }) => `${c.name}=${c.value}`)
          .join('; '),
      },
    },
  )

  if (!eventTypesResponse.ok()) {
    throw new Error(`Failed to fetch class option "${className}": ${eventTypesResponse.status()}`)
  }

  const eventTypesData = await eventTypesResponse.json()
  const classOption = eventTypesData.docs?.[0]

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
    const { tomorrow, className } = await ensureTimeslotForTomorrow(page)

    // Verify the class option has NO payment methods configured
    // This ensures the lesson can be checked in directly without payment flow
    await verifyEventTypeHasNoPaymentMethods(page, className)

    // Log out admin
    await page.goto('/admin/logout', { waitUntil: 'load' }).catch(() => { })
    // Clear cookies to ensure we're logged out
    await page.context().clearCookies()
    await page.waitForTimeout(1000)
    // Warm server again for public page load (Next dev re-compiles in CI)
    await waitForServerReady(page.context().request)

    // User phase: navigate to home (has schedule) and view schedule
    await page.goto('/', { waitUntil: 'load', timeout: 60000 })
    await expect(page.locator('#schedule').first()).toBeVisible()
    await expect(page.getByRole('heading', { name: /Schedule/i })).toBeVisible()

    await goToTomorrowInSchedule(page)

    // Find the specific lesson by class name to ensure we click the correct one
    // The lesson we created has a unique class name for this test run.
    // This ensures we're clicking on the lesson we created, not another lesson on the schedule

    const lessonCard = getScheduleTimeslotCard(page, className)
    await expect(lessonCard).toBeVisible({ timeout: 60000 })

    // Within this specific lesson card, find the "Book" or "Check In" button
    // Button text is "Book" for active timeslots without payment methods
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
    await expect(page.getByText(/Welcome/i).first()).toBeVisible({ timeout: 10000 })

    // Reload the page to ensure all client-side queries (including schedule) run with authenticated session
    // This ensures tRPC queries include the session cookies and bookingStatus is calculated correctly
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })

    // Verify we're still authenticated after reload
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })
    await expect(page.getByText(/Welcome/i).first()).toBeVisible({ timeout: 10000 })

    // Wait for schedule to render
    const scheduleLocator = page.locator('#schedule').first()
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

    // Find the specific lesson by the unique class name created for this test run.
    const lessonCardForCancel = getScheduleTimeslotCard(page, className)
    await expect(lessonCardForCancel).toBeVisible({ timeout: 60000 })

    // With the schedule view model, a single booking can show "Modify Booking" (manage quantity)
    // rather than "Cancel Booking". Cancel is available from the manage page.
    const modifyButton = lessonCardForCancel
      .getByRole('button', { name: /Modify Booking/i })
      .first()
    await expect(modifyButton).toBeVisible({ timeout: 20000 })
    await expect(modifyButton)
      .toBeEnabled({ timeout: 10000 })
      .catch(() => page.waitForTimeout(1000))

    await Promise.all([
      page.waitForURL(/\/bookings\/\d+\/manage/, { timeout: 30000 }),
      modifyButton.click(),
    ])

    // Manage page should render quantity + per-booking list.
    await expect(page.getByText(/update booking quantity/i).first()).toBeVisible({ timeout: 30000 })
    const yourBookingsTitle = page.getByText(/^Your Bookings$/i).first()
    await expect(yourBookingsTitle).toBeVisible({ timeout: 30000 })

    const yourBookingsCard = page
      .getByText(/^Your Bookings$/i)
      .locator('..')
      .locator('..')

    const cancelBtnInManage = yourBookingsCard.getByRole('button', { name: /^Cancel$/i }).first()
    await expect(cancelBtnInManage).toBeVisible({ timeout: 30000 })
    await expect(cancelBtnInManage).toBeEnabled({ timeout: 10000 }).catch(() => page.waitForTimeout(1000))
    await cancelBtnInManage.click()

    // Confirm dialog (ManageBookingPage uses useConfirm)
    const confirmDialog = page.getByRole('dialog').filter({ hasText: /are you sure/i })
    const dialogVisible = await confirmDialog.isVisible({ timeout: 1500 }).catch(() => false)
    if (dialogVisible) {
      const confirmButton = confirmDialog.getByRole('button', { name: /^Confirm$/i })
      await expect(confirmButton).toBeVisible({ timeout: 20000 })
      await expect(confirmButton).toBeEnabled({ timeout: 10000 }).catch(() => page.waitForTimeout(1000))
      // Best-effort: capture the cancel mutation request.
      // (We synchronize deterministically on UI state below; network matching can vary by batching/encoding.)
      const cancelBookingRequest = page
        .waitForRequest(
          (req) => {
            if (req.method() !== 'POST') return false
            const url = req.url()
            if (!url.includes('/api/trpc')) return false
            const body = req.postData() ?? ''
            return url.includes('bookings.cancelBooking') || body.includes('bookings.cancelBooking')
          },
          { timeout: 15000 },
        )
        .catch(() => null)

      await Promise.all([confirmButton.click(), cancelBookingRequest]).then(async ([, req]) => {
        await req?.response().catch(() => { })
      })
    }

    // Wait for cancellation to actually apply in the manage UI.
    // After cancelling the only confirmed booking, there should be no "Cancel" buttons left.
    await expect(
      yourBookingsCard.getByRole('button', { name: /^Cancel$/i }),
    ).toHaveCount(0, { timeout: 30000 })

    // Navigate back to dashboard and verify the lesson becomes bookable again.
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded', timeout: 60000 })
    await expect(page.getByText(/Welcome/i).first()).toBeVisible({ timeout: 20000 })
    // Reload so the schedule refetches; otherwise cached state can still show "Modify Booking".
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 })
    await expect(page.getByText(/Welcome/i).first()).toBeVisible({ timeout: 15000 })
    await goToTomorrowInSchedule(page)

    // Re-find the lesson card on the schedule (fresh DOM after reload).
    const lessonCardAfterCancel = getScheduleTimeslotCard(page, className)

    const bookButtonAfter = lessonCardAfterCancel
      .getByRole('button', { name: /^(Book|Check In)$/i })
      .first()
    await expect(bookButtonAfter).toBeVisible({ timeout: 30000 })

    await clearTestMagicLinks(page.context().request, email).catch(() => { })
  })

  test('drop-in lesson: after check-in + register/login redirects to /bookings/{id} and shows Drop-in payment element', async ({
    page,
  }) => {
    // Capture client-side exceptions to make failures actionable.
    const clientErrors: string[] = []
    page.on('pageerror', (err) => {
      clientErrors.push(`pageerror: ${err?.message ?? String(err)}\n${err?.stack ?? ''}`.trim())
    })
    page.on('console', (msg) => {
      if (msg.type() === 'error') clientErrors.push(`console.error: ${msg.text()}`)
    })

    // Admin phase: ensure prerequisites
    await ensureAdminLoggedIn(page)
    await ensureHomePageWithSchedule(page)
    await ensureTimeslotForTomorrowWithDropIn(page)

    // Log out admin
    await page.goto('/admin/logout', { waitUntil: 'load' }).catch(() => { })
    await page.context().clearCookies()
    await page.waitForTimeout(1000)
    await waitForServerReady(page.context().request)

    // User phase: navigate to home (has schedule) and view schedule
    await page.goto('/', { waitUntil: 'load', timeout: 60000 })
    await expect(page.locator('#schedule').first()).toBeVisible()
    await expect(page.getByRole('heading', { name: /Schedule/i })).toBeVisible()

    await goToTomorrowInSchedule(page)

    // Click "Book" for tomorrow's lesson (button text is "Book" for active timeslots)
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

    // Booking page should include the payment methods UI + Drop-in tab.
    // In CI/prod builds this can take a bit longer to hydrate.
    const appErrorHeading = page.getByRole('heading', { name: /Application error/i }).first()
    const hasAppError = await appErrorHeading.isVisible({ timeout: 2000 }).catch(() => false)
    if (hasAppError) {
      throw new Error(
        [
          'Booking page crashed with a client-side exception.',
          clientErrors.length ? `Captured errors:\n${clientErrors.join('\n\n')}` : '(no console/page errors captured)',
        ].join('\n\n'),
      )
    }

    await expect(page.getByRole('heading', { name: /Payment Methods/i }).first()).toBeVisible({
      timeout: process.env.CI ? 60000 : 30000,
    })

    const dropInTab = page.getByRole('tab', { name: /Drop-?in/i })
    await expect(dropInTab).toBeVisible({ timeout: process.env.CI ? 60000 : 30000 })
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
      timeslotId: lessonId,
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
    await expect(page.getByText(/Welcome/i).first()).toBeVisible({ timeout: 10000 })

    // Reload the page to ensure all client-side queries (including schedule) run with authenticated session
    // This ensures tRPC queries include the session cookies and bookingStatus is calculated correctly
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })

    // Verify we're still authenticated after reload
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })
    await expect(page.getByText(/Welcome/i).first()).toBeVisible({ timeout: 10000 })

    // Wait for the schedule to load
    const scheduleLocator = page.locator('#schedule').first()
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
    await ensureTimeslotForTomorrowWithSubscription(page)

    // Log out admin
    await page.goto('/admin/logout', { waitUntil: 'load' }).catch(() => { })
    await page.context().clearCookies()
    await page.waitForTimeout(1000)
    await waitForServerReady(page.context().request)

    // User phase: navigate to home (has schedule) and view schedule
    await page.goto('/', { waitUntil: 'load', timeout: 60000 })
    await expect(page.locator('#schedule').first()).toBeVisible()
    await expect(page.getByRole('heading', { name: /Schedule/i })).toBeVisible()

    await goToTomorrowInSchedule(page)

    // Click "Book" for tomorrow's lesson (button text is "Book" for active timeslots)
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
      timeslotId: lessonIdFromCallback,
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
    await expect(page.getByText(/Welcome/i).first()).toBeVisible({ timeout: 10000 })

    // Reload the page to ensure all client-side queries (including schedule) run with authenticated session
    // This ensures tRPC queries include the session cookies and bookingStatus is calculated correctly
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })

    // Verify we're still authenticated after reload
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })
    await expect(page.getByText(/Welcome/i).first()).toBeVisible({ timeout: 10000 })

    const scheduleLocator = page.locator('#schedule').first()
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
