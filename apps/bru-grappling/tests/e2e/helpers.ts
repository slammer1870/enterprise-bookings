import { expect, Page, APIRequestContext } from '@playwright/test'
import { waitForServerReady } from '@repo/testing-config/src/playwright'

const MAGIC_LINK_ENDPOINT = '/api/test/magic-links'

type MagicLinkResponse = {
  email: string
  token: string
  url: string
  createdAt: number
}

export { waitForServerReady }

/**
 * Helper to save an object and wait for navigation, with fallback to extract ID from response.
 * Works for class-options, lessons, drop-ins, and other admin objects.
 */
export async function saveObjectAndWaitForNavigation(
  page: Page,
  options: {
    apiPath: string // e.g., '/api/class-options', '/api/lessons'
    expectedUrlPattern: RegExp // e.g., /\/admin\/collections\/class-options\/\d+/
    collectionName: string // e.g., 'class-options', 'lessons' - for error messages
  },
): Promise<void> {
  const { apiPath, expectedUrlPattern, collectionName } = options
  const saveButton = page.getByRole('button', { name: 'Save' })

  // Ensure button is visible and actionable (critical for UI mode)
  await saveButton.waitFor({ state: 'visible', timeout: 30000 })
  await expect(saveButton)
    .toBeEnabled({ timeout: 10000 })
    .catch(() => {
      // If button is disabled, wait a bit more - might be a loading state
      return page.waitForTimeout(1000)
    })

  // Set up navigation and response promises BEFORE clicking (critical for UI mode)
  const navigationTimeout = process.env.CI ? 120000 : 60000
  const navigationPromise = page.waitForURL(expectedUrlPattern, {
    timeout: navigationTimeout,
  })

  // Wait for the creation API response
  const responsePromise = page
    .waitForResponse(
      (response: any) => {
        const url = response.url()
        const method = response.request().method()
        const status = response.status()

        // Strict matching: must be POST request to the API path with creation status
        return (
          method === 'POST' &&
          url.includes(apiPath) &&
          !url.includes(`${apiPath}/`) && // Exclude GET requests to specific objects
          status === 201 // 201 Created is the standard for successful resource creation
        )
      },
      { timeout: navigationTimeout },
    )
    .catch(() => null)

  await saveButton.click()

  // Wait for the response and extract the ID
  let objectId: number | null = null
  try {
    const response = await responsePromise
    if (response) {
      const responseBody = await response.json()
      // Extract ID from response: responseBody.doc.id or responseBody.id
      objectId = responseBody?.doc?.id ?? responseBody?.id ?? null
    }
  } catch (error) {
    // If we can't get the response, continue and try URL check
    console.warn(`Failed to capture ${collectionName} creation response:`, error)
  }

  await page.waitForLoadState('load', { timeout: process.env.CI ? 30000 : 15000 }).catch(() => {})

  // Try to verify we're on the edit page
  try {
    await expect(page).toHaveURL(expectedUrlPattern, {
      timeout: process.env.CI ? 30000 : 10000,
    })
  } catch (error) {
    // If URL check fails but we have the object ID, navigate directly
    if (objectId !== null) {
      console.log(
        `Navigation failed, but ${collectionName} was created with ID ${objectId}. Navigating directly...`,
      )
      const editUrl = `/admin/collections/${collectionName}/${objectId}`
      await page.goto(editUrl, {
        waitUntil: 'domcontentloaded',
        timeout: process.env.CI ? 120000 : 60000,
      })
      // Verify we're on the correct page
      await expect(page).toHaveURL(editUrl, {
        timeout: process.env.CI ? 30000 : 10000,
      })
    } else {
      // If we don't have the ID, re-throw the original error
      throw new Error(
        `Failed to navigate to ${collectionName} edit page and could not extract ID from API response. ` +
          `Current URL: ${page.url()}`,
      )
    }
  }
}

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
 * Clear stored magic links for a specific email or all (test-only endpoint).
 */
export async function clearTestMagicLinks(request: APIRequestContext, email?: string) {
  const endpoint = email
    ? `${MAGIC_LINK_ENDPOINT}?email=${encodeURIComponent(email)}`
    : MAGIC_LINK_ENDPOINT

  const res = await request.delete(endpoint).catch(() => null)
  if (res && res.status() === 404) {
    throw new Error(
      'Test magic link endpoint is disabled. Ensure NODE_ENV=test or ENABLE_TEST_MAGIC_LINKS=true.',
    )
  }
}

/**
 * Poll the test magic-link endpoint for the most recent link for an email.
 */
export async function pollForTestMagicLink(
  request: APIRequestContext,
  email: string,
  attempts = 10,
  delayMs = 1000,
): Promise<MagicLinkResponse> {
  const endpoint = `${MAGIC_LINK_ENDPOINT}?email=${encodeURIComponent(email)}`

  for (let attempt = 0; attempt < attempts; attempt++) {
    const res = await request.get(endpoint).catch(() => null)
    if (res?.ok()) {
      const body = (await res.json()) as MagicLinkResponse
      if (body?.url) {
        return body
      }
    } else if (res?.status() === 404) {
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (body?.error === 'Not found') {
        throw new Error(
          'Test magic link endpoint is disabled. Ensure NODE_ENV=test or ENABLE_TEST_MAGIC_LINKS=true.',
        )
      }
      // If the link isn't found yet, keep polling
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }

  throw new Error(`Magic link not found for ${email} after ${attempts} attempts`)
}

/**
 * Helper function to ensure we're logged in as admin.
 * Creates first user if needed, or assumes we're already logged in.
 * Returns the unique admin email that was created or used.
 */
export async function ensureAdminLoggedIn(page: Page) {
  // Create a unique email for the admin
  const adminEmail = `admin@example.com`
  const adminPassword = 'password123'

  // Warm the server before the first admin navigation (slow on CI)
  await waitForServerReady(page.context().request)

  // Prefer an API-level auth check over UI. The admin UI is responsive and can hide navigation elements.
  const waitForPayloadUser = async (timeoutMs: number) => {
    await expect
      .poll(
        async () => {
          const res = await page.context().request.get('/api/users/me').catch(() => null)
          if (!res || !res.ok()) return false
          const data = await res.json().catch(() => null)
          return Boolean(data?.user?.id || data?.id)
        },
        { timeout: timeoutMs },
      )
      .toBeTruthy()
  }
  const loginButton = page.getByRole('button', { name: /^Login$/i })
  const loginEmail = page.getByRole('textbox', { name: /^Email\s*\*?$/i })
  const loginPassword = page.getByRole('textbox', { name: /^Password\s*\*?$/i })

  const createFirstUserHeading = page.getByRole('heading', { name: /^Welcome$/i })
  const createFirstUserEmail = page.getByRole('textbox', { name: /^Email\s*\*?$/i })
  const createFirstUserNewPassword = page.getByRole('textbox', { name: /^New Password$/i })
  const createFirstUserConfirmPassword = page.getByRole('textbox', { name: /^Confirm Password$/i })
  const createFirstUserEmailVerified = page.getByRole('checkbox', { name: /^Email Verified\s*\*?$/i })
  const createFirstUserCreate = page.getByRole('button', { name: /^Create$/i })

  // Payload shows different error UIs depending on version/theme. Prefer network response for race handling.
  const firstRegisterResponseUrlPart = '/api/users/first-register'

  const isVisible = async (locator: ReturnType<Page['locator']>, timeout = 500) => {
    try {
      await locator.waitFor({ state: 'visible', timeout })
      return true
    } catch {
      return false
    }
  }

  // Avoid `networkidle` because Next dev server keeps sockets open.
  await page.goto('/admin', { waitUntil: 'domcontentloaded', timeout: 120000 })

  // If we already have a valid Payload session, we're done.
  await waitForPayloadUser(2000).catch(() => {})

  // Wait for *one* of the known UI states to appear. This is important on first-load when Next compiles.
  await Promise.race([
    createFirstUserHeading.waitFor({ state: 'visible', timeout: 60000 }),
    loginButton.waitFor({ state: 'visible', timeout: 60000 }),
  ]).catch(() => {})

  // 1) Already logged in
  await waitForPayloadUser(1500).catch(() => {})
  try {
    await waitForPayloadUser(1)
    return
  } catch {
    // continue to UI flows
  }

  // 2) Create-first-user flow (race-safe)
  if ((await isVisible(createFirstUserHeading, 1000)) && (await isVisible(createFirstUserCreate, 1000))) {
    await createFirstUserEmail.waitFor({ state: 'visible', timeout: 20000 })
    await createFirstUserEmail.fill(adminEmail)
    await createFirstUserNewPassword.fill(adminPassword)
    await createFirstUserConfirmPassword.fill(adminPassword)
    await createFirstUserEmailVerified.setChecked(true)

    // Important: admin panel access is gated by `user.roles` containing "admin" (see `checkRole`).
    // Best-effort: set role/roles to admin if the fields exist.
    await page.selectOption('#field-role', { label: 'admin' }).catch(() => {})
    await page.selectOption('#field-roles', { label: 'admin' }).catch(() => {})

    const [firstRegisterResp] = await Promise.all([
      page
        .waitForResponse((resp) => resp.url().includes(firstRegisterResponseUrlPart), { timeout: 20000 })
        .catch(() => null),
      createFirstUserCreate.click(),
    ])

    // If another worker created the first user, we typically get a 400 here (email not unique / invalid).
    // In that case, go to login and sign in with the known credentials.
    if (firstRegisterResp && !firstRegisterResp.ok()) {
      await page.goto('/admin/login', { waitUntil: 'domcontentloaded', timeout: 60000 })
    }

    await Promise.race([
      loginButton.waitFor({ state: 'visible', timeout: 60000 }),
    ]).catch(() => {})
  }

  // 3) Login flow
  if (await isVisible(loginButton, 2000)) {
    await loginEmail.waitFor({ state: 'visible', timeout: 20000 })
    await loginEmail.fill(adminEmail)
    await loginPassword.waitFor({ state: 'visible', timeout: 20000 })
    await loginPassword.fill(adminPassword)
    await loginButton.click()
  }

  // Final assertion: we must be authenticated (API-level)
  await waitForPayloadUser(60000)
}

/**
 * Helper function to mock a Stripe payment intent succeeded webhook.
 * This triggers the webhook handler to confirm a booking for a lesson.
 */
export async function mockPaymentIntentSucceededWebhook(
  request: APIRequestContext,
  options: {
    lessonId: number
    userEmail: string
  },
): Promise<void> {
  const { lessonId, userEmail } = options

  const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000'
  const webhookResponse = await request.post(`${baseUrl}/api/test/mock-payment-intent-webhook`, {
    data: {
      userEmail, // Endpoint will look up user and use their actual stripeCustomerId
      event: {
        data: {
          object: {
            id: `pi_test_${Date.now()}`,
            customer: '', // Will be set by endpoint based on user's actual stripeCustomerId
            metadata: {
              lessonId: lessonId.toString(),
            },
          },
        },
      },
    },
  })

  if (!webhookResponse.ok()) {
    const errorText = await webhookResponse.text().catch(() => 'Unknown error')
    throw new Error(`Failed to trigger webhook: ${webhookResponse.status()} - ${errorText}`)
  }
}

/**
 * Helper function to mock a Stripe subscription created webhook.
 * This confirms the booking for a subscription-only lesson.
 */
export async function mockSubscriptionCreatedWebhook(
  request: APIRequestContext,
  options: {
    lessonId: number
    userEmail: string
  },
): Promise<void> {
  const { lessonId, userEmail } = options

  const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000'
  const webhookResponse = await request.post(
    `${baseUrl}/api/test/mock-subscription-created-webhook`,
    {
      data: {
        userEmail,
        lessonId,
      },
    },
  )

  if (!webhookResponse.ok()) {
    const errorText = await webhookResponse.text().catch(() => 'Unknown error')
    throw new Error(
      `Failed to trigger subscription webhook: ${webhookResponse.status()} - ${errorText}`,
    )
  }
}

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
    await createLink.first().click()
  } else {
    await page
      .getByLabel(/Create new.*Class Option/i)
      .first()
      .click()
  }

  await page.getByRole('textbox', { name: 'Name *' }).waitFor({ state: 'visible', timeout: 10000 })
  await page.getByRole('textbox', { name: 'Name *' }).fill(className)
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
