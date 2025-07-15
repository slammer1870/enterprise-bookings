import { expect, test } from '@playwright/test'
import { config } from '@/payload.config'
import path from 'path'
import { fileURLToPath } from 'url'
import { buildConfig, getPayload, Payload } from 'payload'

import { createDbString } from '@repo/testing-config/src/utils/db'

import { setDbString } from '@repo/testing-config/src/utils/payload-config'

let payload: Payload
let serverURL: string

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

test.describe('Auth', () => {
  test.beforeAll(async () => {
    if (!process.env.DATABASE_URI) {
      const dbString = await createDbString()

      config.db = setDbString(dbString)
    }

    const builtConfig = await buildConfig(config)

    payload = await getPayload({ config: builtConfig })
    await payload.create({
      collection: 'users',
      data: {
        name: 'Admin',
        email: 'admin@example.com',
        password: 'password',
      },
    })

    const user = await payload.find({
      collection: 'users',
      where: { email: { equals: 'test@example.com' } },
    })

    if (user.totalDocs > 0) {
      await payload.delete({
        collection: 'users',
        id: user.docs[0].id.toString(),
      })
    }

    console.log(user)
  })

  test('should register', async ({ page }) => {
    await page.goto('http://localhost:3000/register')

    await page.getByLabel('Name').fill('Test User')
    await page.getByLabel('Email').fill('test@example.com')
    await page.getByPlaceholder('Your Password').fill('password')
    await page.getByPlaceholder('Confirm Password').fill('password')

    await page.getByRole('button', { name: 'Submit' }).click()
  })
})
