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

  // Initial admin navigation; avoid networkidle because Next dev server keeps sockets open
  await page.goto('/admin', { waitUntil: 'domcontentloaded', timeout: 120000 })
  try {
    await page.waitForURL(/\/admin\/(login|create-first-user|$)/, { timeout: 120000 })
  } catch {
    // Retry once with a fresh navigation in case the first wait races a slow dev build on CI
    await page.goto('/admin', { waitUntil: 'domcontentloaded', timeout: 120000 })
    await page.waitForURL(/\/admin\/(login|create-first-user|$)/, { timeout: 120000 })
  }

  // If we're on create-first-user page, create the admin user
  if (page.url().includes('/admin/create-first-user')) {
    await page
      .getByRole('textbox', { name: 'Email *' })
      .waitFor({ state: 'visible', timeout: 20000 })
    await page.getByRole('textbox', { name: 'Email *' }).fill(adminEmail)
    await page.getByRole('textbox', { name: 'New Password' }).fill(adminPassword)
    await page.getByRole('textbox', { name: 'Confirm Password' }).fill(adminPassword)

    // Check Email Verified checkbox
    await page.getByRole('checkbox', { name: 'Email Verified *' }).setChecked(true)

    // Click Create button and wait for response
    // If another worker already created the first user, this will fail
    // In that case, we'll be redirected to login or see an error
    const [response] = await Promise.all([
      page
        .waitForResponse((resp) => resp.url().includes('/api/users/first-register'), {
          timeout: 100000,
        })
        .catch(() => null),
      page.getByRole('button', { name: 'Create' }).click(),
    ])

    // If the response indicates an error (user already exists), navigate to login
    if (response && !response.ok()) {
      await page
        .goto('/admin', { waitUntil: 'domcontentloaded', timeout: 120000 })
        .catch(async () => {
          await page.goto('/admin/login', { waitUntil: 'load', timeout: 120000 })
          await page.waitForURL(/\/admin\/(login|$)/, { timeout: 120000 })
        })
    } else {
      // Wait for navigation - if we're still on create-first-user after timeout, navigate to login
      try {
        await page.waitForURL((url) => !url.pathname.includes('/create-first-user'), {
          timeout: 6000,
        })
      } catch {
        // Still on create-first-user page, likely an error occurred
        await page
          .goto('/admin/login', { waitUntil: 'domcontentloaded', timeout: 30000 })
          .catch(() => {})
      }
    }
  }

  // Re-check URL in case we navigated to login from the create-first-user block
  // Keep timeout modest and retry with a fresh navigation if needed to avoid long stalls.
  const adminLanding = /\/admin\/(login|$)/
  try {
    await page.waitForURL(adminLanding, { timeout: 6000, waitUntil: 'domcontentloaded' })
  } catch {
    await page.goto('/admin', { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForURL(adminLanding, { timeout: 30000 }).catch(() => {})
  }

  // If we're on login page, try to login (assuming user exists)
  if (page.url().includes('/admin/login')) {
    await page.getByRole('textbox', { name: 'Email' }).fill(adminEmail)
    await page.getByRole('textbox', { name: 'Password' }).fill(adminPassword)
    await page.getByRole('button', { name: 'Login' }).click()
  }

  await page.waitForURL(/\/admin$/, { timeout: 10000 }).catch(async () => {
    await page.goto('/admin', { waitUntil: 'domcontentloaded', timeout: 10000 })
  })
  await expect(page).toHaveURL(/\/admin$/)
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
