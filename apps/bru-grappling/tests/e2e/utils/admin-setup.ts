import { Page, expect } from '@playwright/test'
import { TEST_USERS } from './auth'

/**
 * Ensure admin user exists - create if needed
 * This should be called before admin tests when using a fresh database
 */
export async function ensureAdminUser(page: Page): Promise<boolean> {
  try {
    // Navigate to admin with longer timeout
    await page.goto('/admin', { waitUntil: 'load', timeout: 60000 })
  } catch (e) {
    // If navigation times out, try again with networkidle
    try {
      await page.goto('/admin', { waitUntil: 'networkidle', timeout: 60000 })
    } catch (e2) {
      // If still fails, try domcontentloaded
      await page.goto('/admin', { waitUntil: 'domcontentloaded', timeout: 60000 })
    }
  }
  
  await page.waitForTimeout(2000)
  
  const currentUrl = page.url()
  
  // If redirected to create-first-user, create admin user
  if (currentUrl.includes('/admin/create-first-user')) {
    // Fill in the form
    const emailInput = page.getByRole('textbox', { name: /email/i }).first()
    const passwordInput = page.getByRole('textbox', { name: /new password/i }).first()
    const confirmPasswordInput = page.getByRole('textbox', { name: /confirm password/i }).first()
    const nameInput = page.getByRole('textbox', { name: /name/i }).first()
    const emailVerifiedCheckbox = page.getByRole('checkbox', { name: /email verified/i }).first()
    const createButton = page.getByRole('button', { name: /create/i }).first()
    
    await expect(emailInput).toBeVisible({ timeout: 10000 })
    await emailInput.fill(TEST_USERS.admin.email)
    
    await expect(passwordInput).toBeVisible({ timeout: 10000 })
    await passwordInput.fill(TEST_USERS.admin.password)
    
    await expect(confirmPasswordInput).toBeVisible({ timeout: 10000 })
    await confirmPasswordInput.fill(TEST_USERS.admin.password)
    
    if (await nameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await nameInput.fill(TEST_USERS.admin.name)
    }
    
    if (await emailVerifiedCheckbox.isVisible({ timeout: 5000 }).catch(() => false)) {
      await emailVerifiedCheckbox.click()
    }
    
    // Select Admin role
    const roleCombobox = page.locator('input[id*="react-select"][id*="_r_c_"]').first()
    if (await roleCombobox.isVisible({ timeout: 5000 }).catch(() => false)) {
      await roleCombobox.click()
      await page.waitForTimeout(500)
      
      const adminOption = page.getByRole('option', { name: 'Admin' }).first()
      if (await adminOption.isVisible({ timeout: 5000 }).catch(() => false)) {
        await adminOption.click()
        await page.waitForTimeout(500)
      }
    }
    
    // Create user
    await expect(createButton).toBeVisible({ timeout: 10000 })
    await createButton.click()
    
    // Wait for redirect to admin panel - give it more time and handle potential errors
    try {
      await page.waitForURL(/\/admin/, { timeout: 30000 })
      // Double check we're not still on create-first-user page
      const finalUrl = page.url()
      if (finalUrl.includes('/admin/create-first-user')) {
        // Wait a bit more and check for error messages
        await page.waitForTimeout(2000)
        const errorMsg = page.locator('text=/error|failed|invalid/i').first()
        const hasError = await errorMsg.isVisible({ timeout: 2000 }).catch(() => false)
        if (hasError) {
          console.error('Error creating admin user:', await errorMsg.textContent())
          return false
        }
        // Try clicking create again if still on the page
        const createButtonAgain = page.getByRole('button', { name: /create/i }).first()
        if (await createButtonAgain.isVisible({ timeout: 2000 }).catch(() => false)) {
          await createButtonAgain.click()
          await page.waitForURL(/\/admin/, { timeout: 30000 })
        }
      }
      await expect(page).not.toHaveURL(/\/admin\/create-first-user/, { timeout: 5000 })
      return true
    } catch (e) {
      // If we're still on create-first-user after timeout, something went wrong
      const currentUrl = page.url()
      if (currentUrl.includes('/admin/create-first-user')) {
        console.error('Failed to create admin user - still on create-first-user page')
        return false
      }
      // If we're somewhere else in admin, that's fine
      return true
    }
  }
  
          // If redirected to login, admin exists but we need to sign in
          if (currentUrl.includes('/admin/login')) {
            // Wait for login form to fully load
            await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
            await page.waitForTimeout(2000)
            
            // Try multiple selector strategies for login form elements
            let emailInput = page.getByRole('textbox', { name: /email/i }).first()
            let passwordInput = page.getByRole('textbox', { name: /password/i }).first()
            let loginButton = page.getByRole('button', { name: /login/i }).first()
            
            // Fallback selectors if role-based doesn't work
            if (!(await emailInput.isVisible({ timeout: 3000 }).catch(() => false))) {
              emailInput = page.locator('input[type="email"], input[name*="email"]').first()
            }
            if (!(await passwordInput.isVisible({ timeout: 3000 }).catch(() => false))) {
              passwordInput = page.locator('input[type="password"], input[name*="password"]').first()
            }
            if (!(await loginButton.isVisible({ timeout: 3000 }).catch(() => false))) {
              loginButton = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign in"), button:has-text("Log in")').first()
            }
            
            await expect(emailInput).toBeVisible({ timeout: 15000 })
            await emailInput.fill(TEST_USERS.admin.email)
            await expect(passwordInput).toBeVisible({ timeout: 15000 })
            await passwordInput.fill(TEST_USERS.admin.password)
            await expect(loginButton).toBeVisible({ timeout: 15000 })
            await loginButton.click()
    
    // Wait for redirect after login - may take a moment
    await page.waitForTimeout(2000)
    
    // Check if we're still on login page
    let newUrl = page.url()
    let attempts = 0
    while (newUrl.includes('/admin/login') && attempts < 5) {
      await page.waitForTimeout(1000)
      newUrl = page.url()
      attempts++
    }
    
    // If still on login page after attempts, login might have failed
    if (newUrl.includes('/admin/login')) {
      // Check for error messages
      const errorMsg = page.locator('text=/error|invalid|incorrect/i').first()
      const hasError = await errorMsg.isVisible({ timeout: 2000 }).catch(() => false)
      
      if (hasError) {
        // Login failed - credentials might be wrong
        return false
      }
      
      // Try navigating to admin directly - might already be logged in
      try {
        await page.goto('/admin', { waitUntil: 'load', timeout: 30000 })
        await page.waitForTimeout(2000)
        newUrl = page.url()
      } catch (e) {
        // Navigation might have timed out - check current URL
        newUrl = page.url()
        if (!newUrl.includes('/admin') && !newUrl.includes('/auth')) {
          // Not on admin or auth - might be a real error
          throw e
        }
      }
    }
    
    // Verify we're in admin panel
    if (newUrl.includes('/admin/login') || newUrl.includes('/admin/create-first-user')) {
      return false
    }
    
    await expect(page).toHaveURL(/\/admin/)
    return true
  }
  
  // Already in admin panel
  if (currentUrl.includes('/admin') && !currentUrl.includes('/login') && !currentUrl.includes('/create-first-user')) {
    return true
  }
  
  return false
}

