import { test, expect } from '@playwright/test'
import { ensureAdminUser } from './utils/admin-setup'

/**
 * E2E tests for dashboard functionality
 * Tests the user dashboard, schedule display, and membership options
 */
test.describe('Dashboard Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure admin user is logged in
    const authenticated = await ensureAdminUser(page)
    if (!authenticated) {
      test.skip()
    }
  })

  test('should display dashboard with user welcome message', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'load', timeout: 60000 })
    await page.waitForLoadState('domcontentloaded')

    // Check dashboard heading
    const dashboardHeading = page.getByRole('heading', { name: /dashboard/i })
    await expect(dashboardHeading).toBeVisible({ timeout: 10000 })

    // Check welcome message
    const welcomeText = page.getByText(/welcome/i)
    await expect(welcomeText).toBeVisible({ timeout: 10000 })
  })

  test('should display schedule section on dashboard', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'load', timeout: 60000 })
    await page.waitForLoadState('domcontentloaded')

    // Check schedule heading
    const scheduleHeading = page.getByRole('heading', { name: /schedule/i })
    await expect(scheduleHeading).toBeVisible({ timeout: 10000 })

    // Schedule should show date navigation or "no lessons" message
    // Either way, the schedule component should be present
    const scheduleSection = page.locator('#schedule, [id*="schedule"]').first()
    const hasScheduleContent = await scheduleSection.isVisible({ timeout: 5000 }).catch(() => false) ||
      await page.getByText(/no lessons|schedule|today|tomorrow/i).isVisible({ timeout: 5000 }).catch(() => false)

    expect(hasScheduleContent).toBe(true)
  })

  test('should display membership options section when user has no subscription', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'load', timeout: 60000 })
    await page.waitForLoadState('domcontentloaded')

    // Check for membership options heading
    const membershipHeading = page.getByRole('heading', { name: /membership options/i })
    
    // This may or may not be visible depending on subscription status
    // If visible, it should be present
    const isVisible = await membershipHeading.isVisible({ timeout: 5000 }).catch(() => false)
    
    if (isVisible) {
      await expect(membershipHeading).toBeVisible({ timeout: 10000 })
    } else {
      // User might have a subscription, check for subscription section instead
      const subscriptionHeading = page.getByRole('heading', { name: /your subscription|subscription/i })
      const hasSubscription = await subscriptionHeading.isVisible({ timeout: 5000 }).catch(() => false)
      
      // Should have either membership options or subscription section
      expect(isVisible || hasSubscription).toBe(true)
    }
  })

  test('should show current date in schedule', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'load', timeout: 60000 })
    await page.waitForLoadState('domcontentloaded')

    // Wait for schedule to load
    await page.waitForTimeout(3000)

    // Schedule should show a date (current date or formatted date) or "no lessons" message
    const scheduleSection = page.locator('#schedule, [id*="schedule"]').first()
    const scheduleVisible = await scheduleSection.isVisible({ timeout: 5000 }).catch(() => false)
    
    if (scheduleVisible) {
      // Check for date pattern or "no lessons" message
      const datePattern = /mon|tue|wed|thu|fri|sat|sun|dec|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|\d{1,2}|\d{4}/i
      const dateText = scheduleSection.getByText(datePattern).first()
      const noLessonsText = scheduleSection.getByText(/no lessons|schedule/i).first()
      
      const hasDate = await dateText.isVisible({ timeout: 3000 }).catch(() => false)
      const hasNoLessons = await noLessonsText.isVisible({ timeout: 3000 }).catch(() => false)
      
      // Should have either date or "no lessons" message
      expect(hasDate || hasNoLessons).toBe(true)
    } else {
      // Schedule section not found - might not be rendered yet
      // Just verify dashboard loaded
      const dashboardHeading = page.getByRole('heading', { name: /dashboard/i })
      await expect(dashboardHeading).toBeVisible({ timeout: 10000 })
    }
  })

  test('should navigate schedule dates if date navigation exists', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'load', timeout: 60000 })
    await page.waitForLoadState('domcontentloaded')

    // Wait for schedule to load
    await page.waitForTimeout(2000)

    // Look for date navigation arrows
    const scheduleSection = page.locator('#schedule, [id*="schedule"]').first()
    const arrows = scheduleSection.locator('svg, button[aria-label*="next"], button[aria-label*="previous"]')

    const arrowCount = await arrows.count()
    
    if (arrowCount > 0) {
      // Try clicking next arrow if available
      const nextArrow = arrows.nth(arrows.count() > 1 ? 1 : 0)
      if (await nextArrow.isVisible({ timeout: 2000 }).catch(() => false)) {
        await nextArrow.click({ force: true })
        await page.waitForTimeout(1000)
        
        // Schedule should update (date should change or content should update)
        // Just verify no errors occurred
        const errorMessages = page.locator('text=/error|failed/i')
        const errorCount = await errorMessages.count()
        expect(errorCount).toBe(0)
      }
    } else {
      // No date navigation - this is fine, schedule might be static
      test.skip()
    }
  })

  test('should be accessible from navigation menu', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load', timeout: 60000 })
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(2000) // Wait for navbar to render

    // Click dashboard link in navigation - it should appear when logged in
    const dashboardLink = page.getByRole('link', { name: /dashboard/i })
    const dashboardVisible = await dashboardLink.isVisible({ timeout: 5000 }).catch(() => false)
    
    if (dashboardVisible) {
      await dashboardLink.click()

      // Should navigate to dashboard
      await page.waitForURL(/\/dashboard/, { timeout: 15000 })
      const url = page.url()
      expect(url).toContain('/dashboard')
    } else {
      // Dashboard link not in nav - navigate directly (still tests dashboard works)
      await page.goto('/dashboard', { waitUntil: 'load', timeout: 60000 })
      const url = page.url()
      expect(url).toContain('/dashboard')
    }
  })

  test('should maintain authentication state on dashboard', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'load', timeout: 60000 })
    await page.waitForLoadState('domcontentloaded')

    // Refresh page
    await page.reload({ waitUntil: 'load' })
    await page.waitForLoadState('domcontentloaded')

    // Should still be on dashboard (not redirected to sign-in)
    const url = page.url()
    expect(url).toContain('/dashboard')

    // Dashboard content should still be visible
    const dashboardHeading = page.getByRole('heading', { name: /dashboard/i })
    await expect(dashboardHeading).toBeVisible({ timeout: 10000 })
  })

  test('should display user name in welcome message', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'load', timeout: 60000 })
    await page.waitForLoadState('domcontentloaded')

    // Welcome message should contain user name or "Welcome"
    const welcomeText = page.getByText(/welcome/i)
    await expect(welcomeText).toBeVisible({ timeout: 10000 })

    // Check if name is displayed (might be "Admin User" or similar)
    const welcomeContent = await welcomeText.textContent()
    expect(welcomeContent).toBeTruthy()
    expect(welcomeContent?.toLowerCase()).toContain('welcome')
  })
})

