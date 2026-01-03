import 'dotenv/config'

import { createPlaywrightConfig } from '@repo/testing-config/src/playwright'

export default createPlaywrightConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  globalTeardown: './tests/e2e/global-teardown.ts',
  webServerCommand: 'pnpm run payload migrate:fresh --force-accept-warning && pnpm dev',
  webServerUrl: 'http://localhost:3000/api/health',
  extraWebServerEnv: {
    ENABLE_TEST_WEBHOOKS: 'true',
  },
})



