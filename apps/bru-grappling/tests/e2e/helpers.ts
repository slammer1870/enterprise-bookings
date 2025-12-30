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
 * Helper function to wait for navigation with retries for slow CI environments.
 */
async function waitForNavigationWithRetry(
  page: Page,
  urlPattern: RegExp | ((url: URL) => boolean),
  options: { timeout?: number; retries?: number } = {},
): Promise<void> {
  const timeout = options.timeout ?? (process.env.CI ? 180000 : 60000)
  const retries = options.retries ?? (process.env.CI ? 3 : 1)

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      await page.waitForURL(urlPattern, { timeout, waitUntil: 'domcontentloaded' })
      return
    } catch (error) {
      if (attempt === retries - 1) {
        throw error
      }
      // Wait a bit before retrying
      await page.waitForTimeout(2000)
      // Try refreshing the page if we're stuck
      if (attempt > 0) {
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
      }
    }
  }
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

  // Initial admin navigation with retries for slow CI
  const maxRetries = process.env.CI ? 3 : 1
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await page.goto('/admin', { waitUntil: 'domcontentloaded', timeout: 180000 })
      await page.waitForURL(/\/admin\/(login|create-first-user|$)/, { timeout: 180000 })
      break
    } catch (error) {
      if (attempt === maxRetries - 1) {
        throw error
      }
      await page.waitForTimeout(3000)
    }
  }

  // If we're on create-first-user page, create the admin user
  if (page.url().includes('/admin/create-first-user')) {
    await page.getByRole('textbox', { name: 'Email *' }).waitFor({ state: 'visible', timeout: 30000 })
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
          timeout: 120000,
        })
        .catch(() => null),
      page.getByRole('button', { name: 'Create' }).click(),
    ])

    // If the response indicates an error (user already exists), navigate to login
    if (response && !response.ok()) {
      await page.goto('/admin/login', { waitUntil: 'domcontentloaded', timeout: 120000 })
    } else {
      // Wait for navigation - if we're still on create-first-user after timeout, navigate to login
      try {
        await waitForNavigationWithRetry(
          page,
          (url) => !url.pathname.includes('/create-first-user'),
          { timeout: 90000 },
        )
      } catch {
        // Still on create-first-user page, likely an error occurred
        await page.goto('/admin/login', { waitUntil: 'domcontentloaded', timeout: 90000 }).catch(() => {})
      }
    }
  }

  // Re-check URL in case we navigated to login from the create-first-user block
  // Use retry logic for slow CI environments
  const adminLanding = /\/admin\/(login|$)/
  try {
    await waitForNavigationWithRetry(page, adminLanding, { timeout: 90000 })
  } catch {
    await page.goto('/admin', { waitUntil: 'domcontentloaded', timeout: 90000 })
    await waitForNavigationWithRetry(page, adminLanding, { timeout: 60000 }).catch(() => {})
  }

  // If we're on login page, try to login (assuming user exists)
  if (page.url().includes('/admin/login')) {
    await page.getByRole('textbox', { name: 'Email' }).waitFor({ state: 'visible', timeout: 30000 })
    await page.getByRole('textbox', { name: 'Email' }).fill(adminEmail)
    await page.getByRole('textbox', { name: 'Password' }).waitFor({ state: 'visible', timeout: 30000 })
    await page.getByRole('textbox', { name: 'Password' }).fill(adminPassword)
    
    // Wait for login button and click
    const loginButton = page.getByRole('button', { name: 'Login' })
    await loginButton.waitFor({ state: 'visible', timeout: 30000 })
    await loginButton.click()
  }

  // Wait for admin dashboard with retries
  await waitForNavigationWithRetry(page, /\/admin$/, { timeout: 180000 })
  await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {})
  
  // Additional wait to ensure page is fully loaded (especially important in CI)
  await page.waitForTimeout(process.env.CI ? 2000 : 500)
}
