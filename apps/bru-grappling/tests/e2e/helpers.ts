import { APIRequestContext, expect, type Page } from '@playwright/test'
import {
  clearTestMagicLinks,
  ensureAdminLoggedIn,
  mockPaymentIntentSucceededWebhook,
  mockSubscriptionCreatedWebhook,
  pollForTestMagicLink,
  saveObjectAndWaitForNavigation,
  waitForServerReady,
} from '@repo/testing-config/src/playwright'

export { waitForServerReady, ensureAdminLoggedIn, saveObjectAndWaitForNavigation }
export { clearTestMagicLinks, pollForTestMagicLink, mockPaymentIntentSucceededWebhook, mockSubscriptionCreatedWebhook }

/**
 * Helper to save an object and wait for navigation, with fallback to extract ID from response.
 * Works for class-options, lessons, drop-ins, and other admin objects.
 */
// saveObjectAndWaitForNavigation now comes from @repo/testing-config

/**
 * Click a button and wait for navigation to a URL pattern.
 * This is more reliable in UI mode where timing can be different.
 *
 * @param page - The Playwright page
 * @param button - The button locator to click
 * @param urlPattern - The URL pattern to wait for (RegExp or string)
 * @param options - Optional configuration
 */
export async function clickAndWaitForNavigation(
  page: Page,
  button: ReturnType<Page['getByRole']> | ReturnType<Page['locator']>,
  urlPattern: RegExp | string,
  options: {
    timeout?: number
    waitUntil?: 'load' | 'domcontentloaded' | 'networkidle'
    force?: boolean
  } = {},
): Promise<void> {
  const timeout = options.timeout ?? (process.env.CI ? 60000 : 30000)
  const waitUntil = options.waitUntil ?? 'domcontentloaded'
  const force = options.force ?? false

  // Ensure button is actionable (not just visible) - critical for UI mode
  await button.waitFor({ state: 'visible', timeout: 30000 })
  await expect(button)
    .toBeEnabled({ timeout: 10000 })
    .catch(() => {
      // If button is disabled, wait a bit more - might be a loading state
      return page.waitForTimeout(1000)
    })

  // Set up navigation promise BEFORE clicking (critical for UI mode)
  const urlPatternRegex =
    typeof urlPattern === 'string'
      ? new RegExp(urlPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      : urlPattern

  const navigationPromise = page.waitForURL(urlPatternRegex, {
    timeout,
    waitUntil,
  })

  // Also wait for load state to ensure page is ready
  const loadStatePromise = page.waitForLoadState(waitUntil, { timeout }).catch(() => {})

  // Click the button - use Promise.all to ensure click happens while navigation is being watched
  await Promise.all([
    button.click({ force, timeout: 10000 }),
    // Don't await navigation yet, just start watching
  ])

  // Now wait for navigation - this ensures the promise was set up before the click
  try {
    await Promise.race([
      navigationPromise,
      loadStatePromise.then(() => {
        // If load state completes but URL doesn't match, check current URL
        const currentUrl = page.url()
        if (urlPatternRegex.test(currentUrl)) {
          return Promise.resolve()
        }
        return navigationPromise
      }),
    ])
  } catch (error) {
    // Check if we're already on the target URL (might have navigated before promise was set up)
    const currentUrl = page.url()
    if (urlPatternRegex.test(currentUrl)) {
      return
    }
    throw new Error(
      `Navigation failed after button click. Expected URL pattern: ${urlPatternRegex}, ` +
        `Current URL: ${currentUrl}. Original error: ${error}`,
    )
  }
}

/**
 * Helper function to ensure we're logged in as admin.
 * Creates first user if needed, or assumes we're already logged in.
 * Returns the unique admin email that was created or used.
 */
// ensureAdminLoggedIn now comes from @repo/testing-config

/**
 * Helper function to mock a Stripe payment intent succeeded webhook.
 * This triggers the webhook handler to confirm a booking for a lesson.
 */
// mockPaymentIntentSucceededWebhook + mockSubscriptionCreatedWebhook now come from @repo/testing-config

/**
 * Ensure there is at least one Plan available in the admin.
 * Returns the plan name to select.
 */
export async function ensureAtLeastOnePlan(page: Page): Promise<string> {
  const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000'
  const request = page.context().request
  const cookieHeader = async () => {
    const cookies = await page.context().cookies()
    return cookies.map((c) => `${c.name}=${c.value}`).join('; ')
  }

  const ensurePlanHasStripePriceId = async (plan: { id: number | string; name?: string; priceJSON?: string | null }) => {
    const planId = plan?.id
    if (!planId) throw new Error(`Plan is missing id: ${JSON.stringify(plan)}`)

    // If it's already set, keep it.
    try {
      const parsed = plan?.priceJSON ? JSON.parse(plan.priceJSON) : null
      if (parsed?.id && typeof parsed.id === 'string') return
    } catch {
      // we'll overwrite
    }

    const fakeStripePriceId = `price_e2e_${Date.now()}`
    const patchRes = await request.patch(`${baseUrl}/api/plans/${planId}`, {
      headers: { Cookie: await cookieHeader(), 'Content-Type': 'application/json' },
      data: {
        // memberships `PlanDetail` parses `priceJSON` and uses `.id` as the Stripe priceId.
        priceJSON: JSON.stringify({ id: fakeStripePriceId, unit_amount: 1500_00, type: 'recurring' }),
        // Avoid any Stripe sync hooks from running during tests.
        skipSync: true,
      },
    })
    if (!patchRes.ok()) {
      const txt = await patchRes.text().catch(() => '')
      throw new Error(`Failed to patch plan "${plan?.name ?? planId}" priceJSON: ${patchRes.status()} ${txt}`)
    }
  }

  // API-first: avoid flakiness reading admin table text; also ensures seeded plans get patched.
  const existingRes = await request.get(`${baseUrl}/api/plans?limit=1&sort=-createdAt`, {
    headers: { Cookie: await cookieHeader() },
  })
  if (existingRes.ok()) {
    const json = await existingRes.json().catch(() => null)
    const existing = json?.docs?.[0]
    if (existing?.id) {
      await ensurePlanHasStripePriceId(existing)
      return existing?.name ?? 'Plan'
    }
  }

  // No plan exists yet (or API fetch failed). Create via API so we can set hidden fields deterministically.
  const planName = `E2E Plan ${Date.now()}`
  const createRes = await request.post(`${baseUrl}/api/plans`, {
    headers: { Cookie: await cookieHeader(), 'Content-Type': 'application/json' },
    data: {
      name: planName,
      status: 'active',
      priceInformation: { price: 1500, interval: 'month', intervalCount: 1 },
      skipSync: true,
      priceJSON: JSON.stringify({ id: `price_e2e_${Date.now()}`, unit_amount: 1500_00, type: 'recurring' }),
    },
  })
  if (!createRes.ok()) {
    const txt = await createRes.text().catch(() => '')
    throw new Error(`Failed to create plan via API: ${createRes.status()} ${txt}`)
  }
  const created = await createRes.json().catch(() => null)
  if (!created?.doc?.id) {
    throw new Error(`Unexpected create plan response: ${JSON.stringify(created)}`)
  }

  return planName
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
 * Ensure there is a lesson tomorrow whose class option is subscription-only.
 * Returns tomorrow's date.
 */
export async function ensureLessonForTomorrowWithSubscription(page: any): Promise<Date> {
  const className = `E2E Subscription Class ${Date.now()}`
  const planName = await ensureAtLeastOnePlan(page)

  // Create a subscription-only class option
  await page.goto('/admin/collections/class-options', { waitUntil: 'load', timeout: 60000 })
  // "Create new Class Option" is a link in Payload 3.64.0
  const createLink = page.getByRole('link', { name: /Create new.*Class Option/i })
  if ((await createLink.count()) > 0) {
    await Promise.all([
      page.waitForURL(/\/admin\/collections\/class-options\/create/, {
        timeout: process.env.CI ? 60000 : 30000,
      }),
      createLink.first().click(),
    ])
  } else {
    await Promise.all([
      page.waitForURL(/\/admin\/collections\/class-options\/create/, {
        timeout: process.env.CI ? 60000 : 30000,
      }),
      page.getByLabel(/Create new.*Class Option/i).first().click(),
    ])
  }

  const nameField = page.getByRole('textbox', { name: /^Name\s*\*?$/i })
  await nameField.waitFor({ state: 'visible', timeout: process.env.CI ? 30000 : 10000 })
  await nameField.fill(className)
  await page.getByRole('spinbutton', { name: 'Places *' }).fill('10')
  await page
    .getByRole('textbox', { name: 'Description *' })
    .fill('A test class option for e2e (subscription)')

  // Configure payment methods: Allowed Plans (pick first available)
  const allowedPlansCombobox = page
    .locator('text=Allowed Plans')
    .locator('..')
    .locator('[role="combobox"]')
    .first()

  await expect(allowedPlansCombobox).toBeVisible({ timeout: 20000 })
  await allowedPlansCombobox.click()
  const planOption = page.getByRole('option', { name: new RegExp(planName, 'i') })
  if ((await planOption.count()) > 0) {
    await planOption.first().click()
  } else {
    const firstPlan = page.getByRole('option').first()
    await expect(firstPlan).toBeVisible({ timeout: 20000 })
    await firstPlan.click()
  }

  await saveObjectAndWaitForNavigation(page, {
    apiPath: '/api/class-options',
    expectedUrlPattern: /\/admin\/collections\/class-options\/\d+/,
    collectionName: 'class-options',
  })

  // Create lesson for tomorrow
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowDateStr = tomorrow.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

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

  // Verify the selected class option has the required payment method
  await verifyClassOptionPaymentMethod(page, className, 'subscription')

  await saveObjectAndWaitForNavigation(page, {
    apiPath: '/api/lessons',
    expectedUrlPattern: /\/admin\/collections\/lessons\/\d+/,
    collectionName: 'lessons',
  })

  return tomorrow
}
