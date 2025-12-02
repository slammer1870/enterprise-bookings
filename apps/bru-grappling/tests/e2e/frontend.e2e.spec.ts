import { test, expect, Page } from '@playwright/test'

test.describe('Frontend', () => {
  let page: Page

  test.beforeAll(async ({ browser }, testInfo) => {
    const context = await browser.newContext()
    page = await context.newPage()
  })

  test('can go on homepage', async ({ page }) => {
    await page.goto('http://localhost:3000')

    await expect(page).toHaveTitle(/Brú Grappling|Bru Grappling/)

    const heading = page.locator('h1').first()

    await expect(heading).toBeVisible()
  })

  test('can create first admin user', async ({ page }) => {
    // Navigate to admin panel
    await page.goto('http://localhost:3000/admin')

    // Expect redirect to create-first-user page
    await expect(page).toHaveURL(/.*\/admin\/create-first-user/, { timeout: 15000 })

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

