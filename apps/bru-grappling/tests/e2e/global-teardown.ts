import { type FullConfig } from '@playwright/test'

/**
 * Global teardown for Playwright tests
 * Cleans up any test resources created during test execution
 */
async function globalTeardown(config: FullConfig) {
  console.log('Running global teardown...')
  
  // Note: If using testcontainers, the container will be automatically
  // cleaned up when the process exits. No manual cleanup needed here.
  
  console.log('Global teardown complete')
}

export default globalTeardown

