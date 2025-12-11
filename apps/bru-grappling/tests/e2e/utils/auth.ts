import { Page, expect } from '@playwright/test'
import { waitForNavigation } from './wait-helpers'

/**
 * Test user credentials
 */
export const TEST_USERS = {
  admin: {
    email: 'admin@brugrappling.ie',
    password: 'TestPassword123!',
    name: 'Admin User',
  },
  regular: {
    email: 'test@example.com',
    password: 'TestPassword123!',
    name: 'Test User',
  },
} as const

/**
 * Sign in a user via the UI
 * Handles both frontend sign-in and admin panel login
 */
export async function signIn(page: Page, email: string, password: string) {
  // Try to access admin first to see if we need admin login or frontend sign-in
  await page.goto('/admin', { waitUntil: 'domcontentloaded', timeout: 20000 })
  await waitForNavigation(page, 500) // Wait for redirects
  
  const currentUrl = page.url()
  
  // If redirected to admin login, use admin login form
  if (currentUrl.includes('/admin/login')) {
    const emailInput = page.getByRole('textbox', { name: /email/i }).first()
    const passwordInput = page.getByRole('textbox', { name: /password/i }).first()
    const loginButton = page.getByRole('button', { name: /login/i }).first()
    
    await expect(emailInput).toBeVisible({ timeout: 10000 })
    await emailInput.fill(email)
    await expect(passwordInput).toBeVisible({ timeout: 10000 })
    await passwordInput.fill(password)
    await expect(loginButton).toBeVisible({ timeout: 5000 })
    await loginButton.click()
    
    // Wait for redirect from login page
    try {
      await page.waitForURL(url => !url.includes('/admin/login'), { timeout: 5000 })
    } catch {
      // Might already be redirected
    }
    
    let newUrl = page.url()
    
    // If still on login, try navigating to admin
    if (newUrl.includes('/admin/login')) {
      try {
        await page.goto('/admin', { waitUntil: 'domcontentloaded', timeout: 15000 })
        await waitForNavigation(page, 500)
        newUrl = page.url()
      } catch (e) {
        newUrl = page.url()
        if (!newUrl.includes('/admin')) {
          throw e
        }
      }
    }
    
    // Verify we're successfully in admin (not on login or create-first-user)
    const finalUrl = page.url()
    if (!finalUrl.includes('/admin/login') && !finalUrl.includes('/admin/create-first-user')) {
      await expect(page).toHaveURL(/\/admin/)
    }
    return
  }
  
  // Otherwise, use frontend sign-in
  await page.goto('/auth/sign-in', { waitUntil: 'domcontentloaded' })
  
  // Wait for the form to be visible
  const emailInput = page.getByRole('textbox', { name: /email/i }).first()
  await expect(emailInput).toBeVisible({ timeout: 5000 })
  
  await emailInput.fill(email)
  
  // Password field also uses textbox role in this app
  const passwordInput = page.getByRole('textbox', { name: /password/i }).first()
  await expect(passwordInput).toBeVisible({ timeout: 5000 })
  await passwordInput.fill(password)
  
  // Submit the form - look for Login button
  const submitButton = page.getByRole('button', { name: /login/i }).first()
  await expect(submitButton).toBeVisible({ timeout: 5000 })
  await submitButton.click()
  
  // Wait for navigation after sign in - may redirect to home, dashboard, or admin
  try {
    await page.waitForURL(/\/(dashboard|admin|\/)/, { timeout: 10000 })
  } catch (e) {
    // If timeout, check current URL - might already be on a valid page
    const finalUrl = page.url()
    if (finalUrl.includes('/auth/sign-in') || finalUrl.includes('/auth/sign-up')) {
      throw e
    }
  }
  
  // If we're on home page but signed in, navigate to admin
  const finalUrl = page.url()
  if (finalUrl === 'http://localhost:3000/' || finalUrl.endsWith('/')) {
    // Check if we're actually signed in
    const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sign Out")').first()
    const dashboardLink = page.getByRole('link', { name: /dashboard/i }).first()
    const isSignedIn = await logoutButton.isVisible({ timeout: 1000 }).catch(() => false) ||
                       await dashboardLink.isVisible({ timeout: 1000 }).catch(() => false)
    
    if (isSignedIn) {
      // Navigate to admin panel
      await page.goto('/admin', { waitUntil: 'domcontentloaded', timeout: 20000 })
      await page.waitForURL(/\/admin/, { timeout: 5000 }).catch(() => {})
    }
  }
}

/**
 * Sign up a new user via the UI
 */
export async function signUp(page: Page, email: string, password: string, name?: string) {
  await page.goto('/auth/sign-up', { waitUntil: 'domcontentloaded' })
  
  // Wait for the form to be visible
  const form = page.locator('form')
  await expect(form).toBeVisible({ timeout: 5000 })
  
  // Fill name if provided - use textbox role
  if (name) {
    const nameInput = page.getByRole('textbox', { name: /name/i }).first()
    if (await nameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await nameInput.fill(name)
    }
  }
  
  // Use textbox role for email (consistent with sign-in)
  const emailInput = page.getByRole('textbox', { name: /email/i }).first()
  await expect(emailInput).toBeVisible({ timeout: 5000 })
  await emailInput.fill(email)
  
  // Use textbox role for password (consistent with sign-in)
  const passwordInput = page.getByRole('textbox', { name: /password/i }).first()
  await expect(passwordInput).toBeVisible({ timeout: 5000 })
  await passwordInput.fill(password)
  
  // Fill confirm password if it exists
  const passwordInputs = await page.getByRole('textbox', { name: /password/i }).all()
  const passwordCount = passwordInputs.length
  if (passwordCount > 1 && passwordInputs[1]) {
      await passwordInputs[1].fill(password)
  }
  
  // Submit the form - look for Sign Up button
  const submitButton = page.getByRole('button', { name: /sign up|register/i }).first()
  await expect(submitButton).toBeVisible({ timeout: 5000 })
  await submitButton.click()
  
  // Wait for navigation after sign up
  await page.waitForURL(/\/(dashboard|auth)/, { timeout: 10000 })
}

/**
 * Sign out the current user
 */
export async function signOut(page: Page) {
  // Look for sign out button/link in navbar or user menu
  const signOutButton = page.locator('button:has-text("Sign Out"), a:has-text("Sign Out"), button:has-text("Logout")').first()
  
  if (await signOutButton.count() > 0) {
    await signOutButton.click()
    await page.waitForURL(/\/auth\/sign-in|\//, { timeout: 5000 })
  }
}

/**
 * Check if user is signed in by looking for user-specific elements
 */
export async function isSignedIn(page: Page): Promise<boolean> {
  const currentUrl = page.url()
  
  // If we're on auth pages, we're definitely not signed in
  if (currentUrl.includes('/auth/sign-in') || currentUrl.includes('/auth/sign-up')) {
    return false
  }
  
  // If we're on admin or dashboard, likely signed in
  if (currentUrl.includes('/admin') && !currentUrl.includes('/admin/login') && !currentUrl.includes('/admin/create-first-user')) {
    return true
  }
  
  if (currentUrl.includes('/dashboard')) {
    return true
  }
  
  // Check for dashboard or user menu indicators
  const dashboardIndicators = page.locator('text=/dashboard|welcome|sign out|logout/i')
  const count = await dashboardIndicators.count()
  
  // Also check for sign out button/link
  const signOutButton = page.locator('button:has-text("Sign Out"), a:has-text("Sign Out"), button:has-text("Logout")').first()
  const hasSignOut = await signOutButton.isVisible({ timeout: 1000 }).catch(() => false)
  
  return count > 0 || hasSignOut
}

/**
 * Wait for authentication to complete
 */
export async function waitForAuth(page: Page) {
  // Wait for either sign in or dashboard to appear
  await Promise.race([
    page.waitForURL(/\/auth\/sign-in/, { timeout: 3000 }).catch(() => {}),
    page.waitForURL(/\/dashboard/, { timeout: 3000 }).catch(() => {}),
  ])
}

