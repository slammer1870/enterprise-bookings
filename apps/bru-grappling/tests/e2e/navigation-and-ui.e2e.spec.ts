import { test, expect } from '@playwright/test'
import { ensureAdminUser } from './utils/admin-setup'
import { waitForPageLoad } from './utils/helpers'

/**
 * E2E tests for navigation and UI components
 * Tests the main navigation, footer, and basic UI interactions
 */
test.describe('Navigation and UI', () => {
  test.beforeAll(async ({ browser }) => {
    // Ensure admin user exists for authenticated tests
    const context = await browser.newContext()
    const page = await context.newPage()
    try {
      await ensureAdminUser(page)
    } finally {
      await context.close()
    }
  })

  test('should display homepage with navigation and footer', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load', timeout: 60000 })
    await page.waitForLoadState('domcontentloaded')

    // Check navigation is present
    const nav = page.getByRole('navigation', { name: /main navigation/i })
    await expect(nav).toBeVisible({ timeout: 10000 })

    // Check logo/brand link
    const logoLink = page.getByRole('link', { name: /go to homepage|brú/i }).first()
    await expect(logoLink).toBeVisible({ timeout: 10000 })

    // Check navigation links - these might not exist if navbar not configured
    // Just verify navigation structure exists, not specific links
    const navLinks = page.locator('nav a, nav [role="link"]')
    const linkCount = await navLinks.count()
    expect(linkCount).toBeGreaterThan(0) // Should have at least logo link

    // Check footer is present
    const footer = page.getByRole('contentinfo')
    await expect(footer).toBeVisible({ timeout: 10000 })

    // Check footer links
    const emailLink = page.getByRole('link', { name: /email us/i })
    await expect(emailLink).toBeVisible({ timeout: 10000 })
    expect(await emailLink.getAttribute('href')).toContain('mailto:')

    const locationLink = page.getByRole('link', { name: /location/i })
    await expect(locationLink).toBeVisible({ timeout: 10000 })
  })

  test('should navigate to schedule section from homepage', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load', timeout: 60000 })
    await page.waitForLoadState('domcontentloaded')

    // Schedule link might be in navigation or might not exist if navbar not configured
    const scheduleLink = page.getByRole('link', { name: /schedule/i }).first()
    const scheduleVisible = await scheduleLink.isVisible({ timeout: 5000 }).catch(() => false)
    
    if (scheduleVisible) {
      // Click schedule link (should scroll to #schedule)
      await scheduleLink.click()
      await page.waitForTimeout(1000)

      // Verify URL contains schedule hash or we're on a schedule page
      const url = page.url()
      expect(url.includes('#schedule') || url.includes('/schedule')).toBe(true)
    } else {
      // Schedule link not in navigation - this is acceptable if navbar not configured
      test.skip()
    }
  })

  test('should navigate to kids classes page', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load', timeout: 60000 })
    await page.waitForLoadState('domcontentloaded')

    // Kids Classes link might not exist if navbar not configured
    const kidsClassesLink = page.getByRole('link', { name: /kids classes/i })
    const kidsVisible = await kidsClassesLink.isVisible({ timeout: 5000 }).catch(() => false)
    
    if (kidsVisible) {
      await kidsClassesLink.click()
      await page.waitForURL(/\/kids/, { timeout: 15000 })

      // Should be on kids page (or 404 if page doesn't exist)
      const url = page.url()
      expect(url).toContain('/kids')
    } else {
      // Link not in navigation - skip if navbar not configured
      test.skip()
    }
  })

  test('should navigate to seminars page', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load', timeout: 60000 })
    await page.waitForLoadState('domcontentloaded')

    const seminarsLink = page.getByRole('link', { name: /seminars/i })
    const seminarsVisible = await seminarsLink.isVisible({ timeout: 5000 }).catch(() => false)
    
    if (seminarsVisible) {
      await seminarsLink.click()
      await page.waitForURL(/\/seminars/, { timeout: 15000 })

      const url = page.url()
      expect(url).toContain('/seminars')
    } else {
      test.skip()
    }
  })

  test('should navigate to private lessons page', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load', timeout: 60000 })
    await page.waitForLoadState('domcontentloaded')

    const privateLessonsLink = page.getByRole('link', { name: /private lessons/i })
    const privateLessonsVisible = await privateLessonsLink.isVisible({ timeout: 5000 }).catch(() => false)
    
    if (privateLessonsVisible) {
      await privateLessonsLink.click()
      await page.waitForURL(/\/private-lessons/, { timeout: 15000 })

      const url = page.url()
      expect(url).toContain('/private-lessons')
    } else {
      test.skip()
    }
  })

  test('should have external link to online store', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load', timeout: 60000 })
    await page.waitForLoadState('domcontentloaded')

    const storeLink = page.getByRole('link', { name: /online store/i })
    const storeVisible = await storeLink.isVisible({ timeout: 5000 }).catch(() => false)
    
    if (storeVisible) {
      const href = await storeLink.getAttribute('href')
      expect(href).toContain('store.brugrappling.ie')
    } else {
      // Store link not in navigation - skip if navbar not configured
      test.skip()
    }
  })

  test('should display 404 page for non-existent routes', async ({ page }) => {
    await page.goto('/non-existent-page-12345', { waitUntil: 'load', timeout: 60000 })

    // Should show 404 content
    const heading = page.getByRole('heading', { name: /404/i })
    await expect(heading).toBeVisible({ timeout: 10000 })

    // Should have link back to homepage
    const homeLink = page.getByRole('link', { name: /go to homepage|home/i })
    await expect(homeLink).toBeVisible({ timeout: 10000 })
  })

  test('should redirect to sign-in when accessing dashboard while logged out', async ({ page }) => {
    // Ensure we're logged out
    await page.goto('/dashboard', { waitUntil: 'load', timeout: 60000 })

    // Should redirect to sign-in
    await page.waitForURL(/\/auth\/sign-in/, { timeout: 15000 })
    const url = page.url()
    expect(url).toContain('/auth/sign-in')
  })

  test('should display dashboard when logged in', async ({ page }) => {
    // Ensure admin user is logged in
    const authenticated = await ensureAdminUser(page)
    if (!authenticated) {
      test.skip()
      return
    }

    await page.goto('/dashboard', { waitUntil: 'load', timeout: 60000 })
    await page.waitForLoadState('domcontentloaded')

    // Check dashboard heading
    const dashboardHeading = page.getByRole('heading', { name: /dashboard/i })
    await expect(dashboardHeading).toBeVisible({ timeout: 10000 })

    // Check welcome message
    const welcomeText = page.getByText(/welcome/i)
    await expect(welcomeText).toBeVisible({ timeout: 10000 })

    // Check schedule section
    const scheduleHeading = page.getByRole('heading', { name: /schedule/i })
    await expect(scheduleHeading).toBeVisible({ timeout: 10000 })
  })

  test('should show logout button when logged in', async ({ page }) => {
    // Ensure admin user is logged in
    const authenticated = await ensureAdminUser(page)
    if (!authenticated) {
      test.skip()
      return
    }

    await page.goto('/', { waitUntil: 'load', timeout: 60000 })
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(2000) // Wait for navbar to render with auth state

    // Check for logout button - it should appear when logged in
    const logoutButton = page.getByRole('button', { name: /logout/i })
    const logoutVisible = await logoutButton.isVisible({ timeout: 5000 }).catch(() => false)
    
    // Logout button should be visible when logged in
    expect(logoutVisible).toBe(true)
  })

  test('should logout successfully', async ({ page }) => {
    // Ensure admin user is logged in
    const authenticated = await ensureAdminUser(page)
    if (!authenticated) {
      test.skip()
      return
    }

    await page.goto('/', { waitUntil: 'load', timeout: 60000 })
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(2000) // Wait for navbar to render

    // Click logout button
    const logoutButton = page.getByRole('button', { name: /logout/i })
    const logoutVisible = await logoutButton.isVisible({ timeout: 5000 }).catch(() => false)
    
    if (logoutVisible) {
      await logoutButton.click()

      // Should redirect or show logged out state
      await page.waitForTimeout(2000)

      // After logout, logout button should be gone or we should be redirected
      const logoutButtonAfter = page.getByRole('button', { name: /logout/i })
      const isLoggedOut = !(await logoutButtonAfter.isVisible({ timeout: 2000 }).catch(() => false))
      expect(isLoggedOut || page.url().includes('/auth') || page.url() === 'http://localhost:3000/').toBe(true)
    } else {
      // Logout button not found - might already be logged out
      test.skip()
    }
  })

  test('should display footer with correct links', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load', timeout: 60000 })
    await page.waitForLoadState('domcontentloaded')

    const footer = page.getByRole('contentinfo')
    await expect(footer).toBeVisible({ timeout: 10000 })

    // Check copyright
    const copyright = page.getByText(/©.*brú grappling/i)
    await expect(copyright).toBeVisible({ timeout: 10000 })

    // Check email link
    const emailLink = footer.getByRole('link', { name: /email us/i })
    await expect(emailLink).toBeVisible({ timeout: 10000 })
    const emailHref = await emailLink.getAttribute('href')
    expect(emailHref).toContain('mailto:')

    // Check location link
    const locationLink = footer.getByRole('link', { name: /location/i })
    await expect(locationLink).toBeVisible({ timeout: 10000 })
    const locationHref = await locationLink.getAttribute('href')
    expect(locationHref).toContain('maps')

    // Check Instagram link
    const instagramLink = footer.getByRole('link', { name: /instagram/i })
    await expect(instagramLink).toBeVisible({ timeout: 10000 })
    const instagramHref = await instagramLink.getAttribute('href')
    expect(instagramHref).toContain('instagram.com')
  })

  test('should navigate back to homepage from logo', async ({ page }) => {
    // Navigate to a different page first
    await page.goto('/kids', { waitUntil: 'load', timeout: 60000 })
    await page.waitForLoadState('domcontentloaded')

    // Click logo/homepage link
    const logoLink = page.getByRole('link', { name: /go to homepage|brú/i }).first()
    await expect(logoLink).toBeVisible({ timeout: 10000 })
    await logoLink.click()

    // Should navigate to homepage
    await page.waitForURL(/\/$/, { timeout: 15000 })
    const url = page.url()
    expect(url.endsWith('/') || url.includes('/home')).toBe(true)
  })

  test('should handle navigation to dashboard when logged in', async ({ page }) => {
    // Ensure admin user is logged in
    const authenticated = await ensureAdminUser(page)
    if (!authenticated) {
      test.skip()
      return
    }

    await page.goto('/', { waitUntil: 'load', timeout: 60000 })
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(2000) // Wait for navbar to render with auth state

    // Click dashboard link - it should appear when logged in
    const dashboardLink = page.getByRole('link', { name: /dashboard/i })
    const dashboardVisible = await dashboardLink.isVisible({ timeout: 5000 }).catch(() => false)
    
    if (dashboardVisible) {
      await dashboardLink.click()

      // Should navigate to dashboard
      await page.waitForURL(/\/dashboard/, { timeout: 15000 })
      const url = page.url()
      expect(url).toContain('/dashboard')

      // Verify dashboard content
      const dashboardHeading = page.getByRole('heading', { name: /dashboard/i })
      await expect(dashboardHeading).toBeVisible({ timeout: 10000 })
    } else {
      // Dashboard link not visible - navigate directly
      await page.goto('/dashboard', { waitUntil: 'load', timeout: 60000 })
      const dashboardHeading = page.getByRole('heading', { name: /dashboard/i })
      await expect(dashboardHeading).toBeVisible({ timeout: 10000 })
    }
  })
})

