/// <reference types="node" />
import { killProcessOnPort } from '../utils/port.js'

const WEB_SERVER_PORT = 3000

export async function globalTeardown(_config: unknown) {
  console.log('Running global teardown...')
  killProcessOnPort(WEB_SERVER_PORT)
  console.log('Global teardown complete')
}
export default globalTeardown


