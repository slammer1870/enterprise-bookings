import { test as base, type Page } from '@playwright/test'
import { signIn, signOut, TEST_USERS } from './utils/auth'

/**
 * Extended test context with authentication helpers
 */
type TestFixtures = {
  authenticatedPage: {
    page: Page
    user: typeof TEST_USERS.admin
  }
}

export const test = base.extend<TestFixtures>({
  authenticatedPage: async ({ page }, use) => {
    // Sign in before test
    await signIn(page, TEST_USERS.admin.email, TEST_USERS.admin.password)
    await page.waitForURL(/\/(dashboard|admin)/, { timeout: 15000 })
    
    await use({ page, user: TEST_USERS.admin })
    
    // Cleanup: sign out after test
    await signOut(page)
  },
})

export { expect } from '@playwright/test'

