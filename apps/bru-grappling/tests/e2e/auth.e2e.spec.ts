import { test, expect } from '@playwright/test'
import { signIn, signUp, signOut, TEST_USERS, isSignedIn } from './utils/auth'
import { waitForNavigation } from './utils/helpers'

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure we start from a clean state
    await page.goto('/', { waitUntil: 'load', timeout: 60000 })
  })

  test.describe('Sign In', () => {
    test('should redirect to sign in page when accessing protected route', async ({ page }) => {
      await page.goto('/dashboard', { waitUntil: 'load' })
      
      // Should redirect to sign in
      await waitForNavigation(page, /\/auth\/sign-in/)
      await expect(page).toHaveURL(/\/auth\/sign-in/)
    })

    test('should display sign in form', async ({ page }) => {
      await page.goto('/auth/sign-in', { waitUntil: 'load' })
      
      // Check for sign in form elements
      const emailInput = page.locator('input[type="email"], input[name*="email" i]').first()
      const passwordInput = page.locator('input[type="password"]').first()
      const submitButton = page.locator('button[type="submit"], button:has-text("Sign In")').first()
      
      await expect(emailInput).toBeVisible({ timeout: 10000 })
      await expect(passwordInput).toBeVisible()
      await expect(submitButton).toBeVisible()
    })

    test('should sign in with valid credentials', async ({ page }) => {
      // First ensure admin user exists (from admin setup test)
      // Then try to sign in
      await signIn(page, TEST_USERS.admin.email, TEST_USERS.admin.password)
      
      // Should redirect to dashboard or admin - use more flexible wait
      try {
        await waitForNavigation(page, /\/(dashboard|admin)/)
      } catch (e) {
        // If timeout, check current URL - might already be on a valid page
        const currentUrl = page.url()
        if (!currentUrl.includes('/auth/sign-in') && !currentUrl.includes('/auth/sign-up')) {
          // We're not on sign-in page, assume we're signed in
        } else {
          throw e
        }
      }
      
      // Verify we're signed in
      const signedIn = await isSignedIn(page)
      expect(signedIn).toBe(true)
    })

    test('should show error with invalid credentials', async ({ page }) => {
      await page.goto('/auth/sign-in', { waitUntil: 'load' })
      
      const emailInput = page.locator('input[type="email"], input[name*="email" i]').first()
      const passwordInput = page.locator('input[type="password"]').first()
      const submitButton = page.locator('button[type="submit"], button:has-text("Sign In")').first()
      
      await emailInput.fill('invalid@example.com')
      await passwordInput.fill('wrongpassword')
      await submitButton.click()
      
      // Wait a bit for error to appear
      await page.waitForTimeout(2000)
      
      // Check for error message (could be in various forms)
      const errorIndicators = page.locator('text=/error|invalid|incorrect|failed/i')
      const errorCount = await errorIndicators.count()
      
      // Either error message appears or we're still on sign in page
      const stillOnSignIn = page.url().includes('/auth/sign-in')
      expect(errorCount > 0 || stillOnSignIn).toBe(true)
    })
  })

  test.describe('Sign Up', () => {
    test('should display sign up form', async ({ page }) => {
      await page.goto('/auth/sign-up', { waitUntil: 'load' })
      
      // Check for sign up form elements
      const emailInput = page.locator('input[type="email"], input[name*="email" i]').first()
      const passwordInput = page.locator('input[type="password"]').first()
      const submitButton = page.locator('button[type="submit"], button:has-text("Sign Up")').first()
      
      await expect(emailInput).toBeVisible({ timeout: 10000 })
      await expect(passwordInput).toBeVisible()
      await expect(submitButton).toBeVisible()
    })

    test('should navigate between sign in and sign up tabs', async ({ page }) => {
      await page.goto('/auth/sign-in', { waitUntil: 'load' })
      
      // Look for tab switcher
      const signUpTab = page.locator('button:has-text("Sign Up"), [role="tab"]:has-text("Sign Up")').first()
      if (await signUpTab.count() > 0) {
        await signUpTab.click()
        await page.waitForTimeout(500)
        
        // Should see sign up form
        const signUpForm = page.locator('form')
        await expect(signUpForm).toBeVisible()
      }
    })
  })

  test.describe('Sign Out', () => {
    test('should sign out successfully', async ({ page }) => {
      // First sign in
      await signIn(page, TEST_USERS.admin.email, TEST_USERS.admin.password)
      await waitForNavigation(page, /\/(dashboard|admin)/)
      
      // Then sign out
      await signOut(page)
      
      // Should redirect to sign in or home
      await waitForNavigation(page, /\/auth\/sign-in|\//)
      
      // Verify we're signed out
      const signedIn = await isSignedIn(page)
      expect(signedIn).toBe(false)
    })
  })

  test.describe('Protected Routes', () => {
    test('should protect dashboard route', async ({ page }) => {
      await page.goto('/dashboard', { waitUntil: 'load' })
      
      // Should redirect to sign in
      await waitForNavigation(page, /\/auth\/sign-in/)
      await expect(page).toHaveURL(/\/auth\/sign-in/)
    })

    test('should allow access to dashboard after sign in', async ({ page }) => {
      await signIn(page, TEST_USERS.admin.email, TEST_USERS.admin.password)
      
      // Navigate to dashboard
      await page.goto('/dashboard', { waitUntil: 'load' })
      
      // Should be on dashboard
      await expect(page).toHaveURL(/\/dashboard/)
      
      // Should see dashboard content
      const dashboardHeading = page.locator('h1:has-text("Dashboard"), h2:has-text("Dashboard")').first()
      await expect(dashboardHeading).toBeVisible({ timeout: 10000 })
    })
  })
})

