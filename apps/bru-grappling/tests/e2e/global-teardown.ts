import type { FullConfig } from '@playwright/test'

async function globalTeardown(config: FullConfig) {
  console.log('Cleaning up test database...')
  // TestContainer will automatically clean up when the process exits
  console.log('Database cleanup complete')
}

export default globalTeardown

