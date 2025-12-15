import { type FullConfig } from '@playwright/test'
import { exec } from 'child_process'
import util from 'util'

const execAsync = util.promisify(exec)

async function killProcessOnPort(port: number) {
  try {
    if (process.platform === 'win32') {
      // Windows: use netstat to find PIDs then taskkill
      const command = `for /f "tokens=5" %a in ('netstat -ano ^| findstr :${port}') do taskkill /f /pid %a`
      await execAsync(command)
    } else {
      // Unix/macOS: use lsof to find PIDs then kill
      const command = `lsof -ti tcp:${port} | xargs -r kill -9`
      await execAsync(command)
    }
    console.log(`Killed process(es) listening on port ${port}`)
  } catch (error) {
    console.warn(`No process killed on port ${port} or error occurred:`, error)
  }
}

/**
 * Global teardown for Playwright tests
 * Cleans up any test resources created during test execution
 */
async function globalTeardown(config: FullConfig) {
  console.log('Running global teardown...')

  // Note: If using testcontainers, the container will be automatically
  // cleaned up when the process exits. No manual cleanup needed here.
  await killProcessOnPort(3000)

  console.log('Global teardown complete')
}

export default globalTeardown
