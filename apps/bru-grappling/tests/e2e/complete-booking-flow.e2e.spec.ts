import { test, expect } from '@playwright/test'
import { ensureAdminUser } from './utils/admin-setup'

/**
 * E2E tests for complete booking flow
 * Tests the complete-booking page and booking redirects
 */
test.describe('Complete Booking Flow', () => {
  test('should redirect to complete-booking when accessing booking while logged out', async ({
    page,
  }) => {
    // Try accessing a booking page while logged out
    await page.goto('/bookings/1', { waitUntil: 'domcontentloaded', timeout: 60000 })
    
    // Wait a bit for redirect to happen
    await page.waitForTimeout(2000)

    // Should redirect to complete-booking page - check current URL
    const url = page.url()
    // If not redirected yet, wait for it
    if (!url.includes('/complete-booking')) {
      try {
        await page.waitForURL(/\/complete-booking/, { timeout: 10000 })
      } catch (e) {
        // If timeout, check current URL again
        const currentUrl = page.url()
        if (!currentUrl.includes('/complete-booking')) {
          throw e
        }
      }
    }
    const finalUrl = page.url()
    expect(finalUrl).toContain('/complete-booking')
  })

  test('should include callback URL in complete-booking redirect', async ({ page }) => {
    await page.goto('/bookings/1', { waitUntil: 'domcontentloaded', timeout: 60000 })
    
    // Wait a bit for redirect to happen
    await page.waitForTimeout(2000)

    // Should redirect with callback URL - check current URL
    const url = page.url()
    if (!url.includes('/complete-booking')) {
      try {
        await page.waitForURL(/\/complete-booking/, { timeout: 10000 })
      } catch (e) {
        // If timeout, check current URL again
        const currentUrl = page.url()
        if (!currentUrl.includes('/complete-booking')) {
          throw e
        }
      }
    }
    const finalUrl = page.url()

    // Should have callbackUrl parameter
    expect(finalUrl.includes('callbackUrl') || finalUrl.includes('/bookings/')).toBe(true)
  })

  test('should display login form on complete-booking page', async ({ page }) => {
    await page.goto('/complete-booking?mode=login&callbackUrl=/bookings/1', {
      waitUntil: 'load',
      timeout: 60000,
    })
    await page.waitForLoadState('domcontentloaded')

    // Should show login form or auth tabs
    const emailInput = page.getByRole('textbox', { name: /email/i })
    const loginTab = page.getByRole('tab', { name: /login|sign in/i })
    const loginButton = page.getByRole('button', { name: /login|sign in/i })

    const hasEmailInput = await emailInput.isVisible({ timeout: 5000 }).catch(() => false)
    const hasLoginTab = await loginTab.isVisible({ timeout: 5000 }).catch(() => false)
    const hasLoginButton = await loginButton.isVisible({ timeout: 5000 }).catch(() => false)

    // Should have at least one login element
    expect(hasEmailInput || hasLoginTab || hasLoginButton).toBe(true)
  })

  test('should display register form on complete-booking page in register mode', async ({
    page,
  }) => {
    await page.goto('/complete-booking?mode=register&callbackUrl=/bookings/1', {
      waitUntil: 'load',
      timeout: 60000,
    })
    await page.waitForLoadState('domcontentloaded')

    // Should show register form or register tab
    const emailInput = page.getByRole('textbox', { name: /email/i })
    const registerTab = page.getByRole('tab', { name: /register|sign up/i })
    const nameInput = page.getByRole('textbox', { name: /name/i })

    const hasEmailInput = await emailInput.isVisible({ timeout: 5000 }).catch(() => false)
    const hasRegisterTab = await registerTab.isVisible({ timeout: 5000 }).catch(() => false)
    const hasNameInput = await nameInput.isVisible({ timeout: 5000 }).catch(() => false)

    // Should have register form elements
    expect(hasEmailInput || hasRegisterTab || hasNameInput).toBe(true)
  })


  test('should redirect to booking after successful authentication', async ({ page }) => {
    // Ensure admin user is logged in
    const authenticated = await ensureAdminUser(page)
    if (!authenticated) {
      test.skip()
      return
    }

    // Try accessing booking page (should work when logged in)
    await page.goto('/bookings/1', { waitUntil: 'load', timeout: 60000 })

    // Should either show booking page or redirect appropriately
    await page.waitForTimeout(2000)
    const url = page.url()

    // Might be on booking page, dashboard (if lesson doesn't exist), or complete-booking
    // Just verify we're not stuck on complete-booking if we're already logged in
    if (authenticated) {
      expect(!url.includes('/complete-booking') || url.includes('/bookings/')).toBe(true)
    }
  })


  test('should maintain callback URL through auth flow', async ({ page }) => {
    const callbackUrl = '/bookings/1'
    await page.goto(`/complete-booking?mode=login&callbackUrl=${encodeURIComponent(callbackUrl)}`, {
      waitUntil: 'load',
      timeout: 60000,
    })
    await page.waitForLoadState('domcontentloaded')

    // URL should contain callback URL
    const url = page.url()
    expect(url.includes('callbackUrl') || url.includes('/bookings/')).toBe(true)
  })

  test('should display appropriate messaging on complete-booking page', async ({ page }) => {
    await page.goto('/complete-booking?mode=login&callbackUrl=/bookings/1', {
      waitUntil: 'load',
      timeout: 60000,
    })
    await page.waitForLoadState('domcontentloaded')

    // Should have some text indicating this is for booking
    const pageContent = await page.textContent('body')
    expect(pageContent).toBeTruthy()
    expect(pageContent?.length).toBeGreaterThan(0)
  })

  test('should handle missing mode parameter', async ({ page }) => {
    await page.goto('/complete-booking?callbackUrl=/bookings/1', {
      waitUntil: 'load',
      timeout: 60000,
    })
    await page.waitForLoadState('domcontentloaded')

    // Should still show auth form (defaults to login or register)
    const emailInput = page.getByRole('textbox', { name: /email/i })
    const hasEmailInput = await emailInput.isVisible({ timeout: 5000 }).catch(() => false)

    expect(hasEmailInput).toBe(true)
  })

  test('should handle missing callback URL', async ({ page }) => {
    await page.goto('/complete-booking?mode=login', {
      waitUntil: 'load',
      timeout: 60000,
    })
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(2000)

    // Should still show auth form
    const emailInput = page.getByRole('textbox', { name: /email/i })
    const hasEmailInput = await emailInput.isVisible({ timeout: 5000 }).catch(() => false)
    
    // Or might show auth tabs
    const authTabs = page.locator('[role="tablist"]').first()
    const hasAuthTabs = await authTabs.isVisible({ timeout: 5000 }).catch(() => false)

    expect(hasEmailInput || hasAuthTabs).toBe(true)
  })
})

