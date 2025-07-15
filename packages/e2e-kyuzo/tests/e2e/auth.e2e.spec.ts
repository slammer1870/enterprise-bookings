import { expect, test } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

import { getPayload } from 'payload'
import config from '@/payload.config'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

test.describe('Auth', () => {
  test.beforeAll(async () => {
    const payload = await getPayload({ config })

    await payload.create({
      collection: 'users',
      data: {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password',
      },
    })
  })

  test('should register', async ({ page }) => {
    await page.goto('http://localhost:3000/register')

    await page.getByLabel('Name').fill('Test User')
    await page.getByLabel('Email').fill('test@example.com')
    await page.getByPlaceholder('Your Password').fill('password')
    await page.getByPlaceholder('Confirm Password').fill('password')

    await page.getByRole('button', { name: 'Submit' }).click()

    await page.waitForURL('http://localhost:3000/login')

    await page.getByLabel('Email').fill('test@example.com')
    await page.getByPlaceholder('Your Password').fill('password')

    await page.getByRole('button', { name: 'Submit' }).click()

    await page.waitForURL('http://localhost:3000/dashboard')

    const heading = page.locator('h1').first()

    await expect(heading).toHaveText('Dashboard')
  })
})
