/// <reference types="node" />
import { exec } from 'node:child_process'
import util from 'node:util'

const execAsync = util.promisify(exec)

async function killProcessOnPort(port: number) {
  try {
    if (process.platform === 'win32') {
      const command = `for /f "tokens=5" %a in ('netstat -ano ^| findstr :${port}') do taskkill /f /pid %a`
      await execAsync(command)
    } else {
      const command = `lsof -ti tcp:${port} | xargs -r kill -9`
      await execAsync(command)
    }
    console.log(`Killed process(es) listening on port ${port}`)
  } catch (error) {
    console.warn(`No process killed on port ${port} or error occurred:`, error)
  }
}

export async function globalTeardown(_config: unknown) {
  console.log('Running global teardown...')
  await killProcessOnPort(3000)
  console.log('Global teardown complete')
}
export default globalTeardown


