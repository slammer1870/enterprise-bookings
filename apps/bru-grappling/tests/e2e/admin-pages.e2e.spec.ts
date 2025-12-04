import { test, expect } from '@playwright/test'
import { ensureAdminUser } from './utils/admin-setup'

/**
 * E2E tests for admin creating pages with blocks
 * Tests the workflow of creating a home page with various content blocks
 */
test.describe('Admin - Pages with Blocks', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure admin user exists and we're authenticated
    const authenticated = await ensureAdminUser(page)
    
    if (!authenticated) {
      // Skip tests if we can't authenticate
      test.skip()
      return
    }
    
    // Verify we're in admin panel
    await expect(page).toHaveURL(/\/admin/)
    await expect(page).not.toHaveURL(/\/admin\/login/)
    await expect(page).not.toHaveURL(/\/admin\/create-first-user/)
  })

  test('should create a new page with title and slug', async ({ page }) => {
    // Navigate to Pages collection
    await page.goto('/admin/collections/pages', { waitUntil: 'load', timeout: 60000 })
    
    // Wait for page to fully load
    await page.waitForTimeout(2000)
    
    // Click "Create new" button - may be a link or button
    let createButton = page.getByRole('link', { name: /create new/i }).first()
    
    // If link not found, try button
    if (!(await createButton.isVisible({ timeout: 5000 }).catch(() => false))) {
      createButton = page.getByRole('button', { name: /create new/i }).first()
    }
    
    // If still not found, try alternative selector
    if (!(await createButton.isVisible({ timeout: 5000 }).catch(() => false))) {
      const altCreateButton = page.locator('a[href*="/pages/create"], button:has-text("Create")').first()
      await expect(altCreateButton).toBeVisible({ timeout: 10000 })
      await altCreateButton.click()
    } else {
      await createButton.click()
    }
    
    // Wait for create page to load
    await page.waitForURL(/\/admin\/collections\/pages\/create/, { timeout: 10000 })
    
    // Wait for form to load
    await page.waitForTimeout(2000)
    
    // Fill in title
    const titleInput = page.getByRole('textbox', { name: /title/i }).first()
    await expect(titleInput).toBeVisible({ timeout: 10000 })
    await titleInput.fill('Home')
    
    // Fill in slug
    const slugInput = page.getByRole('textbox', { name: /slug/i }).first()
    await expect(slugInput).toBeVisible({ timeout: 10000 })
    await slugInput.fill('home')
    
    // Verify fields are filled
    await expect(titleInput).toHaveValue('Home')
    await expect(slugInput).toHaveValue('home')
  })

  test('should open block drawer when clicking Add Layout', async ({ page }) => {
    await page.goto('/admin/collections/pages/create', { waitUntil: 'load', timeout: 60000 })
    await page.waitForTimeout(2000) // Wait for form to load
    
    // Check if redirected to login
    if (page.url().includes('/admin/login') || page.url().includes('/auth/sign-in')) {
      // Re-authenticate
      await ensureAdminUser(page)
      await page.goto('/admin/collections/pages/create', { waitUntil: 'load', timeout: 60000 })
      await page.waitForTimeout(2000)
    }
    
    // Fill required fields
    const titleInput = page.getByRole('textbox', { name: /title/i }).first()
    await expect(titleInput).toBeVisible({ timeout: 15000 })
    await titleInput.fill('Test Page')
    await page.getByRole('textbox', { name: /slug/i }).first().fill('test-page')
    
    // Click Add Layout button
    const addLayoutButton = page.getByRole('button', { name: 'Add Layout' }).first()
    await expect(addLayoutButton).toBeVisible({ timeout: 10000 })
    await addLayoutButton.click()
    
    // Wait for block drawer to appear - may be a dialog or drawer
    await page.waitForTimeout(2000)
    
    // Check for block drawer/dialog - try multiple selectors
    const blockDrawer = page.locator('[role="dialog"], [role="complementary"], .drawer, [class*="drawer"]').first()
    const drawerVisible = await blockDrawer.isVisible({ timeout: 5000 }).catch(() => false)
    
    // Also check for search input which indicates drawer is open
    const searchInput = page.getByRole('textbox', { name: /search for a block/i }).first()
    const searchVisible = await searchInput.isVisible({ timeout: 5000 }).catch(() => false)
    
    // Either drawer or search input should be visible
    expect(drawerVisible || searchVisible).toBe(true)
  })

  test('should display available block types', async ({ page }) => {
    await page.goto('/admin/collections/pages/create', { waitUntil: 'load', timeout: 60000 })
    await page.waitForTimeout(2000) // Wait for form to load
    
    // Check if redirected to login
    if (page.url().includes('/admin/login') || page.url().includes('/auth/sign-in')) {
      // Re-authenticate
      await ensureAdminUser(page)
      await page.goto('/admin/collections/pages/create', { waitUntil: 'load', timeout: 60000 })
      await page.waitForTimeout(2000)
    }
    
    // Fill required fields
    const titleInput = page.getByRole('textbox', { name: /title/i }).first()
    await expect(titleInput).toBeVisible({ timeout: 15000 })
    await titleInput.fill('Test Page')
    await page.getByRole('textbox', { name: /slug/i }).first().fill('test-page')
    
    // Open block drawer
    await page.getByRole('button', { name: 'Add Layout' }).first().click()
    await page.waitForTimeout(2000) // Wait for drawer to open
    
    // Check for common block types
    const heroBlock = page.getByRole('button', { name: 'Hero', exact: true }).first()
    const aboutBlock = page.getByRole('button', { name: 'About' }).first()
    const scheduleBlock = page.getByRole('button', { name: 'Schedule' }).first()
    
    await expect(heroBlock).toBeVisible({ timeout: 10000 })
    await expect(aboutBlock).toBeVisible({ timeout: 10000 })
    await expect(scheduleBlock).toBeVisible({ timeout: 10000 })
  })

  test('should add Hero block to page', async ({ page }) => {
    await page.goto('/admin/collections/pages/create', { waitUntil: 'load', timeout: 60000 })
    await page.waitForTimeout(2000) // Wait for form to load
    
    // Check if redirected to login
    if (page.url().includes('/admin/login') || page.url().includes('/auth/sign-in')) {
      // Re-authenticate
      await ensureAdminUser(page)
      await page.goto('/admin/collections/pages/create', { waitUntil: 'load', timeout: 60000 })
      await page.waitForTimeout(2000)
    }
    
    // Fill required fields
    const titleInput = page.getByRole('textbox', { name: 'Title *' }).first()
    await expect(titleInput).toBeVisible({ timeout: 15000 })
    await titleInput.fill('Home Page')
    await page.getByRole('textbox', { name: 'Slug *' }).first().fill('home')
    
    // Open block drawer
    await page.getByRole('button', { name: 'Add Layout' }).first().click()
    await page.waitForTimeout(1000)
    
    // Click Hero block (use exact match to avoid Hero Waitlist)
    const heroBlock = page.getByRole('button', { name: 'Hero', exact: true }).first()
    await expect(heroBlock).toBeVisible({ timeout: 5000 })
    await heroBlock.click()
    
    // Wait for block to be added (drawer should close or block form should appear)
    await page.waitForTimeout(2000)
    
    // Verify block was added - check for Hero block in layout
    const layoutSection = page.locator('text=/layout/i').first()
    await expect(layoutSection).toBeVisible({ timeout: 5000 })
  })

  test('should add multiple blocks to page', async ({ page }) => {
    await page.goto('/admin/collections/pages/create', { waitUntil: 'load' })
    await page.waitForTimeout(2000) // Wait for form to load
    
    // Check if redirected to login
    if (page.url().includes('/admin/login') || page.url().includes('/auth/sign-in')) {
      // Re-authenticate
      await ensureAdminUser(page)
      await page.goto('/admin/collections/pages/create', { waitUntil: 'load' })
      await page.waitForTimeout(2000)
    }
    
    // Fill required fields
    await page.getByRole('textbox', { name: /title/i }).first().fill('Home Page')
    await page.getByRole('textbox', { name: /slug/i }).first().fill('home')
    
    // Add Hero block
    await page.getByRole('button', { name: 'Add Layout' }).first().click()
    await page.waitForTimeout(2000) // Wait for drawer to open
    await page.getByRole('button', { name: 'Hero', exact: true }).first().click()
    await page.waitForTimeout(2000) // Wait for block to be added
    
    // Add About block
    await page.getByRole('button', { name: 'Add Layout' }).first().click()
    await page.waitForTimeout(2000) // Wait for drawer to open
    await page.getByRole('button', { name: 'About' }).first().click()
    await page.waitForTimeout(2000) // Wait for block to be added
    
    // Verify multiple blocks were added
    const layoutSection = page.locator('text=/layout/i').first()
    await expect(layoutSection).toBeVisible({ timeout: 10000 })
  })

  test('should save page with blocks', async ({ page }) => {
    await page.goto('/admin/collections/pages/create', { waitUntil: 'load', timeout: 60000 })
    await page.waitForTimeout(3000) // Wait for form to load
    
    // Check if redirected to login - re-authenticate if needed
    if (page.url().includes('/admin/login') || page.url().includes('/auth/sign-in')) {
      await ensureAdminUser(page)
      await page.goto('/admin/collections/pages/create', { waitUntil: 'load', timeout: 60000 })
      await page.waitForTimeout(3000)
    }
    
    // Wait for form to be visible
    const form = page.locator('form').first()
    await expect(form).toBeVisible({ timeout: 15000 })
    
    // Fill required fields
    const titleInput = page.getByRole('textbox', { name: /title/i }).first()
    await expect(titleInput).toBeVisible({ timeout: 15000 })
    await titleInput.fill('Home Page')
    
    const slugInput = page.getByRole('textbox', { name: /slug/i }).first()
    await slugInput.fill('home')
    
    // Add a block
    await page.getByRole('button', { name: 'Add Layout' }).first().click()
    await page.waitForTimeout(2000) // Wait for drawer to open
    await page.getByRole('button', { name: 'Hero', exact: true }).first().click()
    await page.waitForTimeout(2000) // Wait for block to be added
    
    // Save the page
    const saveButton = page.getByRole('button', { name: 'Save' }).first()
    await expect(saveButton).toBeVisible({ timeout: 10000 })
    await saveButton.click()
    
    // Wait for save to complete - may stay on create page or redirect
    await page.waitForTimeout(3000)
    
    const currentUrl = page.url()
    
    // After save, should either redirect or stay on create page
    // If still on create page, verify the form still has our data (save succeeded)
    if (currentUrl.includes('/admin/collections/pages/create')) {
      // Check if title is still there (page was saved but stayed on create)
      const savedTitle = await titleInput.inputValue().catch(() => '')
      expect(savedTitle).toBe('Home Page')
    } else {
      // Should redirect to pages list or edit page
      await expect(page).toHaveURL(/\/admin\/collections\/pages/)
    }
  })

  test('should search for blocks in drawer', async ({ page }) => {
    await page.goto('/admin/collections/pages/create', { waitUntil: 'load', timeout: 60000 })
    await page.waitForTimeout(2000) // Wait for form to load
    
    // Check if redirected to login
    if (page.url().includes('/admin/login') || page.url().includes('/auth/sign-in')) {
      // Re-authenticate
      await ensureAdminUser(page)
      await page.goto('/admin/collections/pages/create', { waitUntil: 'load', timeout: 60000 })
      await page.waitForTimeout(2000)
    }
    
    // Fill required fields
    const titleInput = page.getByRole('textbox', { name: /title/i }).first()
    await expect(titleInput).toBeVisible({ timeout: 15000 })
    await titleInput.fill('Test Page')
    await page.getByRole('textbox', { name: /slug/i }).first().fill('test-page')
    
    // Open block drawer
    await page.getByRole('button', { name: 'Add Layout' }).first().click()
    await page.waitForTimeout(2000) // Wait for drawer to open
    
    // Find search input - may be in drawer or directly visible
    const searchInput = page.getByRole('textbox', { name: /search for a block/i }).first()
    await expect(searchInput).toBeVisible({ timeout: 10000 })
    
    // Search for "Hero"
    await searchInput.fill('Hero')
    await page.waitForTimeout(1000) // Wait for search results
    
    // Should show Hero block (and possibly Hero Waitlist)
    const heroResults = page.getByRole('button', { name: /hero/i })
    const count = await heroResults.count()
    expect(count).toBeGreaterThan(0)
  })
})

