import { expect, test } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

test.describe('Auth', () => {
  test('should register', async ({ page }) => {
    await page.goto('http://localhost:3000/register')

    await page.getByLabel('Name').fill('Test User')
    await page.getByLabel('Email').fill('test@example.com')
    await page.getByPlaceholder('Your Password').fill('password')
    await page.getByPlaceholder('Confirm Password').fill('password')

    await page.getByRole('button', { name: 'Submit' }).click()
  })
})
