import { chromium, type FullConfig } from '@playwright/test'

import { createDbString } from '@repo/testing-config/src/utils/db'

import { setDbString } from '@repo/testing-config/src/utils/payload-config'

async function globalSetup(config: FullConfig) {
  if (!process.env.DATABASE_URI) {
    const dbString = await createDbString()

    process.env.DATABASE_URI = dbString
  }
}

export default globalSetup
