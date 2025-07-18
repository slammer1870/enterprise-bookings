import { test } from '@playwright/test'

test.describe('Booking', () => {
  test('create a new child bookings', async ({ page }) => {
    //Try to go to dahsboard page
    await page.goto('http://localhost:3000/dashboard')
    //Expect to be redirected to login page
    await page.waitForURL('http://localhost:3000/login', { timeout: 30000 })

    //login as normal user
    await page.getByRole('textbox', { name: 'Email' }).click()
    await page.getByRole('textbox', { name: 'Email' }).fill('user@example.com')
    await page.getByRole('textbox', { name: 'Password' }).click()
    await page.getByRole('textbox', { name: 'Password' }).fill('password')
    await page.getByRole('button', { name: 'Submit' }).click()

    //Expect to be redirected to dashboard page
    await page.waitForURL('http://localhost:3000/dashboard', { timeout: 30000 })

    //Expect to be redirected to bookings page
    await page.getByRole('button', { name: 'Check Child In' }).click()
    await page.waitForURL(/http:\/\/localhost:3000\/bookings\/children\/\d+/, {
      timeout: 100000,
    })
  })
})
