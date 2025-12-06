import { test, expect } from '@playwright/test'
import { signIn, TEST_USERS } from './utils/auth'

/**
 * E2E tests for page creation using Playwright MCP Server
 * 
 * This test file demonstrates how to use the Playwright MCP server
 * to interactively explore and test the page creation workflow.
 * 
 * To use this with MCP:
 * 1. Start the test in debug mode: pnpm exec playwright test --debug admin-page-creation-mcp.e2e.spec.ts
 * 2. Use Cursor's AI assistant with MCP commands to:
 *    - Navigate to pages
 *    - Take snapshots of the UI
 *    - Interact with elements
 *    - Generate additional test assertions
 * 
 * Example MCP commands to try:
 * - "Navigate to the admin pages collection"
 * - "Take a snapshot of the page creation form"
 * - "Click the add block button and show me the options"
 * - "Fill in the form to create a homepage with a schedule block"
 */
test.describe('Admin Page Creation with MCP', () => {
  test.beforeEach(async ({ page }) => {
    // Sign in as admin
    await signIn(page, TEST_USERS.admin.email, TEST_USERS.admin.password)
    // Give more time for redirect and accept either admin or home page
    await page.waitForTimeout(3000)
    
    // If we're on home page, navigate to admin
    const currentUrl = page.url()
    if (!currentUrl.includes('/admin')) {
      await page.goto('/admin', { waitUntil: 'load', timeout: 60000 })
      await page.waitForTimeout(2000)
    }
  })

  test('MCP: explore page creation form', async ({ page }) => {
    // Navigate to page creation
    await page.goto('/admin/collections/pages/create', { waitUntil: 'load', timeout: 60000 })
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
    await page.waitForTimeout(2000)
    
    // At this point, you can use MCP commands to:
    // - Take a snapshot: "Take a snapshot of the current page"
    // - Explore elements: "What form fields are visible?"
    // - Interact: "Click on the add block button"
    
    // Basic verification that we're on the right page
    await expect(page).toHaveURL(/\/admin\/collections\/pages\/create/)
    
    // Take a screenshot for reference
    await page.screenshot({ 
      path: 'test-results/page-creation-form.png', 
      fullPage: true 
    })
  })

  test('MCP: create homepage with schedule block step by step', async ({ page }) => {
    // Step 1: Navigate to page creation
    await page.goto('/admin/collections/pages/create', { waitUntil: 'load', timeout: 60000 })
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
    await page.waitForTimeout(2000)
    
    // MCP Checkpoint 1: "Take a snapshot to see the initial form"
    await page.screenshot({ path: 'test-results/mcp-step1-initial-form.png', fullPage: true })
    
    // Step 2: Fill in title
    const titleField = page.locator('input[name="title"], input[id*="title"]').first()
    await expect(titleField).toBeVisible({ timeout: 10000 })
    await titleField.fill('MCP Test Homepage')
    
    // MCP Checkpoint 2: "Verify title was filled"
    await page.screenshot({ path: 'test-results/mcp-step2-title-filled.png' })
    
    // Step 3: Fill in slug
    const slugField = page.locator('input[name="slug"], input[id*="slug"]').first()
    await expect(slugField).toBeVisible({ timeout: 10000 })
    await slugField.fill('mcp-test-homepage')
    
    // MCP Checkpoint 3: "Verify slug was filled"
    await page.screenshot({ path: 'test-results/mcp-step3-slug-filled.png' })
    
    // Step 4: Add a schedule block
    // MCP Command: "Click the add block button and show available block types"
    const addBlockButton = page.locator('button:has-text("Add"), button:has-text("Add Block")').first()
    await expect(addBlockButton).toBeVisible({ timeout: 10000 })
    await addBlockButton.click()
    await page.waitForTimeout(1000)
    
    // MCP Checkpoint 4: "Take a snapshot of the block type selector"
    await page.screenshot({ path: 'test-results/mcp-step4-block-selector.png', fullPage: true })
    
    // Step 5: Select schedule block
    const scheduleOption = page.locator('button:has-text("Schedule"), [role="option"]:has-text("Schedule"), li:has-text("Schedule")').first()
    await expect(scheduleOption).toBeVisible({ timeout: 10000 })
    await scheduleOption.click()
    await page.waitForTimeout(1000)
    
    // Close the drawer
    await page.keyboard.press('Escape')
    await page.waitForTimeout(1000)
    
    // MCP Checkpoint 5: "Verify schedule block was added"
    await page.screenshot({ path: 'test-results/mcp-step5-schedule-added.png', fullPage: true })
    
    // Step 6: Save the page
    const saveButton = page.locator('button:has-text("Save"), button[type="submit"]').first()
    await expect(saveButton).toBeVisible({ timeout: 10000 })
    await saveButton.click()
    await page.waitForTimeout(3000)
    
    // MCP Checkpoint 6: "Take a snapshot of the saved page"
    await page.screenshot({ path: 'test-results/mcp-step6-saved.png', fullPage: true })
    
    // Verify we're still on the admin page (edit or list)
    const currentUrl = page.url()
    expect(currentUrl).toContain('/admin/collections/pages')
  })

  test('MCP: verify schedule block appears on frontend', async ({ page }) => {
    // First create a page with schedule block
    await page.goto('/admin/collections/pages/create', { waitUntil: 'load', timeout: 60000 })
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
    await page.waitForTimeout(2000)
    
    // Fill in details
    const titleField = page.locator('input[name="title"], input[id*="title"]').first()
    await titleField.fill('Frontend Test Page')
    
    const slugField = page.locator('input[name="slug"], input[id*="slug"]').first()
    await slugField.fill('frontend-test-page')
    
    // Add schedule block
    const addBlockButton = page.locator('button:has-text("Add"), button:has-text("Add Block")').first()
    await addBlockButton.click()
    await page.waitForTimeout(1000)
    
    const scheduleOption = page.locator('button:has-text("Schedule"), [role="option"]:has-text("Schedule"), li:has-text("Schedule")').first()
    await scheduleOption.click()
    await page.waitForTimeout(1000)
    
    // Close the drawer
    await page.keyboard.press('Escape')
    await page.waitForTimeout(1000)
    
    // Save
    const saveButton = page.locator('button:has-text("Save"), button[type="submit"]').first()
    await saveButton.click()
    await page.waitForTimeout(3000)
    
    // Now navigate to the frontend page
    await page.goto('/frontend-test-page', { waitUntil: 'load', timeout: 60000 })
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
    await page.waitForTimeout(2000)
    
    // MCP Command: "Take a snapshot of the frontend page"
    await page.screenshot({ path: 'test-results/mcp-frontend-page.png', fullPage: true })
    
    // Verify schedule component is visible
    // The schedule block should render a schedule component
    const scheduleSection = page.locator('#schedule, [id*="schedule"], text=/schedule/i').first()
    
    // Take screenshot whether or not it's visible for debugging
    await page.screenshot({ path: 'test-results/mcp-schedule-check.png', fullPage: true })
    
    // Check if schedule section exists (might not be visible if no classes scheduled)
    const scheduleExists = await scheduleSection.count() > 0
    expect(scheduleExists).toBe(true)
  })

  test('MCP: test all available block types', async ({ page }) => {
    // Navigate to page creation
    await page.goto('/admin/collections/pages/create', { waitUntil: 'load', timeout: 60000 })
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
    await page.waitForTimeout(2000)
    
    // Fill in basic details
    const titleField = page.locator('input[name="title"], input[id*="title"]').first()
    await titleField.fill('All Blocks Test')
    
    const slugField = page.locator('input[name="slug"], input[id*="slug"]').first()
    await slugField.fill('all-blocks-test')
    
    // Click add block to see all options
    const addBlockButton = page.locator('button:has-text("Add"), button:has-text("Add Block")').first()
    await addBlockButton.click()
    await page.waitForTimeout(1000)
    
    // MCP Command: "Take a snapshot and list all available block types"
    await page.screenshot({ path: 'test-results/mcp-all-block-types.png', fullPage: true })
    
    // Get all block options
    const blockOptions = page.locator('[role="option"], button[class*="block"], li[class*="block"]')
    const blockCount = await blockOptions.count()
    
    console.log(`Found ${blockCount} block types`)
    
    // List all block types (for MCP exploration)
    for (let i = 0; i < blockCount; i++) {
      const option = blockOptions.nth(i)
      const text = await option.textContent().catch(() => '')
      console.log(`Block type ${i + 1}: ${text}`)
    }
    
    // Verify Schedule is one of the options
    const scheduleOption = page.locator('button:has-text("Schedule"), [role="option"]:has-text("Schedule"), li:has-text("Schedule")').first()
    const scheduleVisible = await scheduleOption.isVisible({ timeout: 5000 }).catch(() => false)
    
    expect(scheduleVisible).toBe(true)
  })

  test('MCP: interactive debugging session', async ({ page }) => {
    // This test is designed to be run with --debug flag
    // It sets up the page and waits for MCP commands
    
    await page.goto('/admin/collections/pages/create', { waitUntil: 'load', timeout: 60000 })
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
    await page.waitForTimeout(2000)
    
    // At this point, use MCP commands to:
    // 1. "Take a snapshot of the page"
    // 2. "What elements are visible on the page?"
    // 3. "Click on [specific element]"
    // 4. "Fill in the form with test data"
    // 5. "Add a schedule block"
    // 6. "Save the page"
    
    // Basic assertion to keep test valid
    await expect(page).toHaveURL(/\/admin\/collections\/pages\/create/)
    
    // Add a pause for interactive debugging (only works with --debug)
    // await page.pause()
  })
})

/**
 * Helper test to clean up test pages
 * Run this after testing to remove test pages
 */
test.describe('Cleanup Test Pages', () => {
  test.skip('delete test pages', async ({ page }) => {
    // Sign in as admin
    await signIn(page, TEST_USERS.admin.email, TEST_USERS.admin.password)
    await page.waitForURL(/\/admin/, { timeout: 15000 })
    
    // Navigate to pages list
    await page.goto('/admin/collections/pages', { waitUntil: 'load', timeout: 60000 })
    await page.waitForTimeout(2000)
    
    // MCP Command: "Show me all pages and help me delete test pages"
    await page.screenshot({ path: 'test-results/mcp-pages-list.png', fullPage: true })
    
    // Note: Actual deletion logic would go here
    // This is skipped by default to avoid accidental deletions
  })
})

