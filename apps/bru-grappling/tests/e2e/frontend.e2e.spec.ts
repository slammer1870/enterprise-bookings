import { test, expect } from '@playwright/test'

test.describe('Frontend', () => {
  test('can create first admin user', async ({ page }) => {
    // Navigate to admin panel and wait for navigation
    // Use 'load' instead of 'networkidle' to avoid timeout issues with background requests
    await page.goto('http://localhost:3000/admin', { waitUntil: 'load', timeout: 60000 })

    // Wait for redirect to create-first-user page
    // Payload redirects to /admin/create-first-user when no users exist
    await page.waitForURL(/.*\/admin\/create-first-user/, { timeout: 30000 })
    await expect(page).toHaveURL(/.*\/admin\/create-first-user/, { timeout: 10000 })

    // Wait for the form to be visible
    const form = page.locator('form')
    await expect(form).toBeVisible({ timeout: 10000 })

    // Fill in email field (using more flexible selector)
    const emailInput = page.locator('input[type="email"], input[name*="email" i]').first()
    await expect(emailInput).toBeVisible()
    await emailInput.fill('admin@brugrappling.ie')

    // Fill in password field
    const passwordInput = page.locator('input[type="password"]').first()
    await expect(passwordInput).toBeVisible()
    await passwordInput.fill('TestPassword123!')

    // Fill in confirm password if it exists
    const passwordInputs = page.locator('input[type="password"]')
    const passwordCount = await passwordInputs.count()
    if (passwordCount > 1) {
      await passwordInputs.nth(1).fill('TestPassword123!')
    }

    // Fill in name field if it exists
    const nameInput = page.locator('input[name*="name" i]').first()
    if (await nameInput.count() > 0) {
      await nameInput.fill('Admin User')
    }

    // Submit the form - look for submit button
    const submitButton = page.locator('button[type="submit"], button:has-text("Create"), button:has-text("Save")').first()
    await expect(submitButton).toBeVisible()
    await submitButton.click()

    // Wait for redirect to admin dashboard after user creation
    // Payload redirects to /admin after creating first user
    await expect(page).toHaveURL(/.*\/admin/, { timeout: 15000 })
    
    // Verify we're NOT on create-first-user page anymore
    await expect(page).not.toHaveURL(/.*\/admin\/create-first-user/)
    
    // Verify we're in the admin panel (should see admin UI elements)
    await expect(page.locator('nav, [data-payload-admin]')).toBeVisible({ timeout: 5000 })
  })
})

