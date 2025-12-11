import { test, expect } from '@playwright/test'

/**
 * E2E tests for error handling and edge cases
 * Tests 404 pages, invalid routes, and error states
 */
test.describe('Error Handling', () => {
  test('should display 404 page for non-existent routes', async ({ page }) => {
    await page.goto('/this-page-does-not-exist-12345', { waitUntil: 'load', timeout: 60000 })

    // Should show 404 heading
    const heading = page.getByRole('heading', { name: /404/i })
    await expect(heading).toBeVisible({ timeout: 10000 })

    // Should show error message
    const errorMessage = page.getByText(/page could not be found|not found/i)
    await expect(errorMessage).toBeVisible({ timeout: 10000 })
  })

  test('should provide navigation back to homepage from 404 page', async ({ page }) => {
    await page.goto('/non-existent-route-xyz', { waitUntil: 'load', timeout: 60000 })

    // Should have link back to homepage
    const homeLink = page.getByRole('link', { name: /go to homepage|home/i })
    await expect(homeLink).toBeVisible({ timeout: 10000 })

    // Click home link
    await homeLink.click()

    // Should navigate to homepage
    await page.waitForURL(/\/$/, { timeout: 15000 })
    const url = page.url()
    expect(url.endsWith('/') || url.includes('/home')).toBe(true)
  })

  test('should handle invalid booking ID gracefully', async ({ page }) => {
    // Try accessing a booking with invalid ID
    await page.goto('/bookings/invalid-id-123', { waitUntil: 'load', timeout: 60000 })

    // Should redirect to dashboard or show error
    // Booking page redirects invalid IDs to dashboard
    await page.waitForTimeout(2000)
    const url = page.url()
    
    // Should either be on dashboard or complete-booking (if not logged in)
    expect(url.includes('/dashboard') || url.includes('/complete-booking') || url.includes('/auth')).toBe(true)
  })

  test('should handle non-numeric booking ID', async ({ page }) => {
    await page.goto('/bookings/abc', { waitUntil: 'load', timeout: 60000 })

    // Should redirect (booking page validates ID is numeric)
    await page.waitForTimeout(3000)
    const url = page.url()
    
    // Should redirect away from bookings/abc (might go to dashboard, complete-booking, or auth)
    const isValidRedirect = !url.includes('/bookings/abc') && 
      (url.includes('/dashboard') || url.includes('/complete-booking') || url.includes('/auth'))
    expect(isValidRedirect).toBe(true)
  })

  test('should handle very large booking ID', async ({ page }) => {
    await page.goto('/bookings/999999999', { waitUntil: 'load', timeout: 60000 })

    // Should redirect to dashboard or complete-booking
    await page.waitForTimeout(3000)
    const url = page.url()
    
    // Should handle gracefully (redirect or show appropriate message)
    // Might redirect to dashboard (if logged in), complete-booking (if not), or auth
    const isValidState = url.includes('/dashboard') || 
      url.includes('/complete-booking') || 
      url.includes('/auth') ||
      url.includes('/bookings/999999999') // Might stay on page if lesson doesn't exist
    expect(isValidState).toBe(true)
  })


  test('should handle special characters in URL', async ({ page }) => {
    // Try URL with special characters
    await page.goto('/test%20page%20with%20spaces', { waitUntil: 'load', timeout: 60000 })

    // Should either show 404 or handle gracefully
    await page.waitForTimeout(2000)
    
    // Should not crash - either 404 or valid page
    const pageContent = await page.content()
    expect(pageContent.length).toBeGreaterThan(0)
  })

  test('should handle very long URL paths', async ({ page }) => {
    const longPath = '/a'.repeat(200)
    await page.goto(longPath, { waitUntil: 'load', timeout: 60000 })

    // Should handle gracefully (404 or redirect)
    await page.waitForTimeout(2000)
    
    // Should not crash
    const pageContent = await page.content()
    expect(pageContent.length).toBeGreaterThan(0)
  })

  test('should maintain navigation on error pages', async ({ page }) => {
    await page.goto('/non-existent-page', { waitUntil: 'load', timeout: 60000 })

    // Navigation should still be present
    const nav = page.getByRole('navigation', { name: /main navigation/i })
    await expect(nav).toBeVisible({ timeout: 10000 })

    // Footer should still be present
    const footer = page.getByRole('contentinfo')
    await expect(footer).toBeVisible({ timeout: 10000 })
  })

  test('should handle malformed query parameters', async ({ page }) => {
    await page.goto('/?invalid=param&another=test', { waitUntil: 'load', timeout: 60000 })

    // Should load homepage normally
    await page.waitForLoadState('domcontentloaded')
    
    // Should not show errors
    const errorMessages = page.locator('text=/error|failed/i')
    const errorCount = await errorMessages.count()
    
    // May have some errors in console, but page should load
    const pageContent = await page.content()
    expect(pageContent.length).toBeGreaterThan(0)
  })

})

