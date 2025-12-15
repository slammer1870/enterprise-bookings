import { test, expect } from '@playwright/test'

/**
 * E2E test for first admin user registration flow
 * Tests the flow when accessing /admin with a fresh database:
 * 1. Navigate to /admin
 * 2. Should redirect to /admin/login
 * 3. Since there are no users, should redirect to /admin/create-first-user
 * 4. Fill out the form to create the first admin user
 * 5. Should redirect to /admin dashboard after successful creation
 *
 * Note: These tests require a fresh database with no users. If users already exist,
 * the tests will skip gracefully. The webServer config runs `migrate:fresh` which
 * should provide a clean database, but if using an existing DATABASE_URI, tests
 * will handle the populated state.
 */

/**
 * Helper function to check if users already exist in the database
 * Returns true if we can reach create-first-user page (no users), false if stuck on login (users exist)
 */
async function canReachCreateFirstUserPage(page: any): Promise<boolean> {
  await page.goto('/admin', { waitUntil: 'load', timeout: 60000 })
  await page.waitForURL(/\/admin\/(login|create-first-user)/, { timeout: 10000 })

  if (page.url().includes('/admin/login')) {
    // Wait a short time to see if it redirects to create-first-user
    try {
      await page.waitForURL(/\/admin\/create-first-user/, { timeout: 3000 })
      return true
    } catch {
      // Still on login - user exists
      return false
    }
  }

  return page.url().includes('/admin/create-first-user')
}

test.describe('Admin First User Registration', () => {
  test('should redirect through login to create-first-user page when no users exist', async ({
    page,
  }) => {
    // Check if we can reach the create-first-user page (requires no users)
    const canReach = await canReachCreateFirstUserPage(page)
    if (!canReach) {
      // Users already exist - skip this test gracefully
      test
        .info()
        .skip(true, 'Users already exist in database - this test requires a fresh database')
      return
    }

    // Should eventually be redirected to /admin/create-first-user (since no users exist)
    // The redirect might go through /admin/login first, but we should end up at create-first-user
    await expect(page).toHaveURL(/\/admin\/create-first-user/)

    // Verify we're on the create first user page
    const heading = page.getByRole('heading', { name: 'Welcome' })
    await expect(heading).toBeVisible({ timeout: 10000 })

    const description = page.getByText('To begin, create your first user.')
    await expect(description).toBeVisible({ timeout: 10000 })
  })

  test('should create first admin user successfully', async ({ page }) => {
    // Check if we can reach the create-first-user page (requires no users)
    const canReach = await canReachCreateFirstUserPage(page)
    if (!canReach) {
      // Users already exist - skip this test gracefully
      test
        .info()
        .skip(true, 'Users already exist in database - this test requires a fresh database')
      return
    }

    // Verify we're on the create first user page (after potential redirect through login)
    await expect(page).toHaveURL(/\/admin\/create-first-user/)

    // Fill in email
    const emailField = page.getByRole('textbox', { name: 'Email *' })
    await expect(emailField).toBeVisible({ timeout: 10000 })
    await emailField.fill('admin@example.com')

    // Fill in password
    const passwordField = page.getByRole('textbox', { name: 'New Password' })
    await expect(passwordField).toBeVisible({ timeout: 10000 })
    await passwordField.fill('password123')

    // Fill in confirm password
    const confirmPasswordField = page.getByRole('textbox', { name: 'Confirm Password' })
    await expect(confirmPasswordField).toBeVisible({ timeout: 10000 })
    await confirmPasswordField.fill('password123')

    // Change role to Admin
    // Find the Role combobox - it's near the "Role" label
    const roleCombobox = page
      .locator('text=Role')
      .locator('..')
      .locator('[role="combobox"]')
      .first()
    await expect(roleCombobox).toBeVisible({ timeout: 10000 })

    // Click the combobox to open the dropdown
    await roleCombobox.click()

    // Wait for the dropdown menu to appear with options
    // The listbox should become visible after clicking
    const adminOption = page.getByRole('option', { name: 'Admin' })
    await expect(adminOption).toBeVisible({ timeout: 10000 })
    await adminOption.click()

    // Wait for role to be selected
    await page.waitForTimeout(500)

    // Click Create button
    const createButton = page.getByRole('button', { name: 'Create' })
    await expect(createButton).toBeVisible({ timeout: 10000 })
    await createButton.click()

    // Wait for redirect to admin dashboard
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(2000)

    // Should be redirected to /admin dashboard
    await expect(page).toHaveURL(/\/admin$/)

    // Verify we're on the dashboard (should see "Dashboard" heading or similar)
    const dashboardHeading = page
      .getByRole('heading', { name: /dashboard/i })
      .or(page.getByText(/dashboard/i))
      .first()
    await expect(dashboardHeading).toBeVisible({ timeout: 10000 })
  })

  test('should complete full flow from /admin to dashboard', async ({ page }) => {
    // Check if we can reach the create-first-user page (requires no users)
    const canReach = await canReachCreateFirstUserPage(page)
    if (!canReach) {
      // Users already exist - skip this test gracefully
      test
        .info()
        .skip(true, 'Users already exist in database - this test requires a fresh database')
      return
    }

    // Should eventually redirect to /admin/create-first-user
    await expect(page).toHaveURL(/\/admin\/create-first-user/)

    // Verify create first user page elements
    await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('To begin, create your first user.')).toBeVisible({
      timeout: 10000,
    })

    // Fill out the form
    await page.getByRole('textbox', { name: 'Email *' }).fill('admin@example.com')
    await page.getByRole('textbox', { name: 'New Password' }).fill('password123')
    await page.getByRole('textbox', { name: 'Confirm Password' }).fill('password123')

    // Select Admin role
    const roleCombobox = page
      .locator('text=Role')
      .locator('..')
      .locator('[role="combobox"]')
      .first()
    await expect(roleCombobox).toBeVisible({ timeout: 10000 })
    await roleCombobox.click()

    const adminOption = page.getByRole('option', { name: 'Admin' })
    await expect(adminOption).toBeVisible({ timeout: 10000 })
    await adminOption.click()

    // Submit the form
    await page.getByRole('button', { name: 'Create' }).click()

    // Wait for redirect to dashboard
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(2000)

    // Verify we're on the admin dashboard
    await expect(page).toHaveURL(/\/admin$/)

    // Verify dashboard content is visible
    const dashboardContent = page
      .getByText(/dashboard/i)
      .or(page.getByRole('heading', { name: /dashboard/i }))
      .first()
    await expect(dashboardContent).toBeVisible({ timeout: 10000 })
  })
})
