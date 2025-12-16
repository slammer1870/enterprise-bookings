import { expect, Page } from '@playwright/test'

/**
 * Helper function to ensure we're logged in as admin.
 * Creates first user if needed, or assumes we're already logged in.
 * Returns the unique admin email that was created or used.
 */
export async function ensureAdminLoggedIn(page: Page) {
  // Create a unique email for the admin
  const adminEmail = `admin@example.com`
  const adminPassword = 'password123'

  await page.goto('/admin', { waitUntil: 'load', timeout: 100000 })
  await page.waitForURL(/\/admin\/(login|create-first-user|$)/, { timeout: 100000 })

  // If we're on create-first-user page, create the admin user
  if (page.url().includes('/admin/create-first-user')) {
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
      await page.goto('/admin/login', { waitUntil: 'load', timeout: 100000 })
    } else {
      // Wait for navigation - if we're still on create-first-user after timeout, navigate to login
      try {
        await page.waitForURL((url) => !url.pathname.includes('/create-first-user'), {
          timeout: 100000,
        })
      } catch {
        // Still on create-first-user page, likely an error occurred
        await page.goto('/admin/login', { waitUntil: 'load', timeout: 100000 })
      }
    }
  }

  // Re-check URL in case we navigated to login from the create-first-user block
  await page.waitForURL(/\/admin\/(login|$)/, { timeout: 100000 }).catch(() => {})

  // If we're on login page, try to login (assuming user exists)
  if (page.url().includes('/admin/login')) {
    await page.getByRole('textbox', { name: 'Email' }).fill(adminEmail)
    await page.getByRole('textbox', { name: 'Password' }).fill(adminPassword)
    await page.getByRole('button', { name: 'Login' }).click()
  }

  await page.waitForURL(/\/admin$/, { timeout: 100000 })
}
