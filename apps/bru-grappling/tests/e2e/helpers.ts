import { expect } from '@playwright/test'

/**
 * Helper function to ensure we're logged in as admin.
 * Creates first user if needed, or assumes we're already logged in.
 */
export async function ensureAdminLoggedIn(page: any): Promise<void> {
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
    await page.waitForTimeout(10000)

    if (page.url().includes('/admin/create-first-user')) {
      await page.goto('/admin/login', { waitUntil: 'load', timeout: 60000 })
      await page.getByRole('textbox', { name: 'Email' }).fill('admin@example.com')
      await page.getByRole('textbox', { name: 'Password' }).fill('password123')
      await page.getByRole('button', { name: 'Login' }).click()
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
      await page.waitForTimeout(2000)
    }
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
