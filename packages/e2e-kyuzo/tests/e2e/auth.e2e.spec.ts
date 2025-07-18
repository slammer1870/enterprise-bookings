import { expect, test } from '@playwright/test'

test.describe('Auth', () => {
  test('should register and login', async ({ page }) => {
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
