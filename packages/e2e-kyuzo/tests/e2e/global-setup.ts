import { chromium, type FullConfig } from '@playwright/test'

import { createDbString } from '@repo/testing-config/src/utils/db'

import { setDbString } from '@repo/testing-config/src/utils/payload-config'

async function globalSetup(config: FullConfig) {
  console.log('globalSetup')
  console.log(process.env.DATABASE_URI)
  if (!process.env.DATABASE_URI) {
    const dbString = await createDbString()

    process.env.DATABASE_URI = dbString
  }

  console.log('Seeding database')

  const response = await fetch(`${config.webServer?.url}/api/seed`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error('Failed to seed database')
  }

  console.log('Database seeded successfully')
}

export default globalSetup
