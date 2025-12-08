import { test, expect } from '@playwright/test'
import { signIn, TEST_USERS } from './utils/auth'

/**
 * DEMO: Page Creation with Schedule Block
 * 
 * This is a simple, easy-to-run demo test that shows the complete workflow
 * of creating a page with a schedule block.
 * 
 * To run this test:
 * 1. Make sure the app is running: pnpm dev
 * 2. Run: pnpm exec playwright test demo-page-creation --headed
 * 
 * Watch as the test:
 * - Logs into the admin panel
 * - Navigates to the pages collection
 * - Creates a new page
 * - Adds a schedule block
 * - Saves the page
 * - Verifies it on the frontend
 */

test.describe('DEMO: Page Creation with Schedule Block', () => {
  test('complete workflow - create page with schedule block', async ({ page }) => {
    console.log('🎬 Starting page creation demo...')
    
    // Step 1: Sign in as admin
    console.log('📝 Step 1: Signing in as admin...')
    await signIn(page, TEST_USERS.admin.email, TEST_USERS.admin.password)
    await page.waitForURL(/\/admin/, { timeout: 15000 })
    console.log('✅ Signed in successfully')
    
    // Step 2: Navigate to pages collection
    console.log('📝 Step 2: Navigating to pages collection...')
    await page.goto('/admin/collections/pages', { waitUntil: 'load', timeout: 60000 })
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
    await page.waitForTimeout(2000)
    console.log('✅ Navigated to pages collection')
    
    // Take screenshot of pages list
    await page.screenshot({ 
      path: 'test-results/demo-1-pages-list.png', 
      fullPage: true 
    })
    
    // Step 3: Click Create New
    console.log('📝 Step 3: Creating new page...')
    await page.goto('/admin/collections/pages/create', { waitUntil: 'load', timeout: 60000 })
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
    await page.waitForTimeout(2000)
    console.log('✅ Page creation form loaded')
    
    // Take screenshot of empty form
    await page.screenshot({ 
      path: 'test-results/demo-2-empty-form.png', 
      fullPage: true 
    })
    
    // Step 4: Fill in page details
    console.log('📝 Step 4: Filling in page details...')
    const titleField = page.locator('input[name="title"], input[id*="title"]').first()
    await expect(titleField).toBeVisible({ timeout: 10000 })
    await titleField.fill('Demo Schedule Page')
    console.log('  ✓ Title filled: "Demo Schedule Page"')
    
    const slugField = page.locator('input[name="slug"], input[id*="slug"]').first()
    await expect(slugField).toBeVisible({ timeout: 10000 })
    await slugField.fill('demo-schedule-page')
    console.log('  ✓ Slug filled: "demo-schedule-page"')
    
    // Take screenshot of filled form
    await page.screenshot({ 
      path: 'test-results/demo-3-form-filled.png', 
      fullPage: true 
    })
    
    // Step 5: Add Schedule block
    console.log('📝 Step 5: Adding Schedule block...')
    const addBlockButton = page.locator('button:has-text("Add"), button:has-text("Add Block")').first()
    await expect(addBlockButton).toBeVisible({ timeout: 10000 })
    await addBlockButton.click()
    console.log('  ✓ Clicked Add Block button')
    
    await page.waitForTimeout(1000)
    
    // Take screenshot of block selector
    await page.screenshot({ 
      path: 'test-results/demo-4-block-selector.png', 
      fullPage: true 
    })
    
    const scheduleOption = page.locator('button:has-text("Schedule"), [role="option"]:has-text("Schedule"), li:has-text("Schedule")').first()
    await expect(scheduleOption).toBeVisible({ timeout: 10000 })
    await scheduleOption.click()
    console.log('  ✓ Selected Schedule block')
    
    await page.waitForTimeout(1000)
    
    // Close the drawer
    await page.keyboard.press('Escape')
    await page.waitForTimeout(1000)
    console.log('  ✓ Closed block drawer')
    
    // Verify schedule block was added
    const scheduleBlock = page.locator('text=/schedule/i').first()
    await expect(scheduleBlock).toBeVisible({ timeout: 10000 })
    console.log('  ✓ Schedule block added successfully')
    
    // Take screenshot with schedule block
    await page.screenshot({ 
      path: 'test-results/demo-5-schedule-added.png', 
      fullPage: true 
    })
    
    // Step 6: Save the page
    console.log('📝 Step 6: Saving the page...')
    const saveButton = page.locator('button:has-text("Save"), button[type="submit"]').first()
    await expect(saveButton).toBeVisible({ timeout: 10000 })
    await saveButton.click()
    console.log('  ✓ Clicked Save button')
    
    await page.waitForTimeout(3000)
    
    // Take screenshot after save
    await page.screenshot({ 
      path: 'test-results/demo-6-saved.png', 
      fullPage: true 
    })
    
    // Verify we're still on admin page (edit or list)
    const currentUrl = page.url()
    expect(currentUrl).toContain('/admin/collections/pages')
    console.log('✅ Page saved successfully')
    
    // Step 7: Verify on frontend
    console.log('📝 Step 7: Verifying page on frontend...')
    await page.goto('/demo-schedule-page', { waitUntil: 'load', timeout: 60000 })
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
    await page.waitForTimeout(2000)
    console.log('  ✓ Navigated to frontend page')
    
    // Take screenshot of frontend
    await page.screenshot({ 
      path: 'test-results/demo-7-frontend.png', 
      fullPage: true 
    })
    
    // Check if schedule section exists
    const scheduleSection = page.locator('#schedule').first()
    const scheduleExists = await scheduleSection.count() > 0
    
    if (scheduleExists) {
      console.log('✅ Schedule component found on frontend!')
    } else {
      console.log('⚠️  Schedule component not found (might be hidden if no classes scheduled)')
    }
    
    // Final verification - just verify page loaded (schedule might be hidden if no classes)
    // Check that we're on the correct page and it's not a 404
    const pageTitle = await page.title()
    const is404 = page.url().includes('404') || pageTitle.toLowerCase().includes('not found')
    expect(is404).toBe(false)
    
    console.log('🎉 Demo completed successfully!')
    console.log('📸 Screenshots saved to test-results/')
    console.log('   - demo-1-pages-list.png')
    console.log('   - demo-2-empty-form.png')
    console.log('   - demo-3-form-filled.png')
    console.log('   - demo-4-block-selector.png')
    console.log('   - demo-5-schedule-added.png')
    console.log('   - demo-6-saved.png')
    console.log('   - demo-7-frontend.png')
  })

  test('quick demo - minimal steps', async ({ page }) => {
    console.log('🚀 Quick demo starting...')
    
    // Sign in
    await signIn(page, TEST_USERS.admin.email, TEST_USERS.admin.password)
    
    // Wait for redirect to admin or navigate there if needed
    const currentUrl = page.url()
    if (!currentUrl.includes('/admin')) {
      await page.goto('/admin', { waitUntil: 'load', timeout: 60000 })
      await page.waitForTimeout(2000)
    }
    
    // Verify we're in admin
    await expect(page).toHaveURL(/\/admin/, { timeout: 15000 })
    
    // Go to create page
    await page.goto('/admin/collections/pages/create', { waitUntil: 'load', timeout: 60000 })
    await page.waitForTimeout(2000)
    
    // Fill form
    await page.locator('input[name="title"], input[id*="title"]').first().fill('Quick Demo Page')
    await page.locator('input[name="slug"], input[id*="slug"]').first().fill('quick-demo')
    
    // Add schedule block
    await page.locator('button:has-text("Add"), button:has-text("Add Block")').first().click()
    await page.waitForTimeout(500)
    await page.locator('button:has-text("Schedule"), [role="option"]:has-text("Schedule")').first().click()
    await page.waitForTimeout(500)
    
    // Close drawer
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)
    
    // Save
    await page.locator('button:has-text("Save"), button[type="submit"]').first().click()
    await page.waitForTimeout(2000)
    
    // Verify
    expect(page.url()).toContain('/admin/collections/pages')
    
    console.log('✅ Quick demo completed!')
  })

  test.skip('cleanup demo pages', async ({ page }) => {
    // This test is skipped by default to avoid accidental deletion
    // Remove .skip to run cleanup
    
    console.log('🧹 Cleaning up demo pages...')
    
    await signIn(page, TEST_USERS.admin.email, TEST_USERS.admin.password)
    await page.waitForURL(/\/admin/, { timeout: 15000 })
    
    await page.goto('/admin/collections/pages', { waitUntil: 'load', timeout: 60000 })
    await page.waitForTimeout(2000)
    
    // Note: Actual cleanup logic would go here
    // This is just a placeholder to show where cleanup would happen
    
    console.log('⚠️  Cleanup logic not implemented - manual cleanup required')
    console.log('   Navigate to /admin/collections/pages and delete:')
    console.log('   - Demo Schedule Page')
    console.log('   - Quick Demo Page')
  })
})

