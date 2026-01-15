import type { APIRequestContext, Page } from '@playwright/test'
import {
  ensureAdminLoggedIn,
  mockSubscriptionCreatedWebhook,
  saveObjectAndWaitForNavigation,
  waitForServerReady,
} from '@repo/testing-config/src/playwright'

export { waitForServerReady, ensureAdminLoggedIn, saveObjectAndWaitForNavigation }

export async function registerUserWithEmailPassword(
  page: Page,
  opts: { name: string; email: string; password: string; callbackPath?: string },
) {
  const { name, email, password, callbackPath } = opts

  const url = callbackPath
    ? `/auth/sign-up?callbackUrl=${encodeURIComponent(callbackPath)}`
    : '/auth/sign-up'

  await page.goto(url, { waitUntil: 'load', timeout: 60000 })

  // Wait for the form to be visible
  const emailInput = page.getByRole('textbox', { name: /email/i }).first()
  await emailInput.waitFor({ state: 'visible', timeout: 30000 })

  const nameInput = page.getByRole('textbox', { name: /name/i }).first()
  const passwordInput = page.getByRole('textbox', { name: /password/i }).first()

  // Fill form fields with waits between to ensure React state updates
  if ((await nameInput.count()) > 0) {
    await nameInput.fill(name)
  }
  await emailInput.fill(email)
  await passwordInput.fill(password)

  // Wait for form validation to complete
  await page.waitForTimeout(1000)

  // Better Auth UI uses "Create an account" as the submit button text
  const submit = page
    .getByRole('button', { name: /create.*account|sign.*up|submit/i })
    .first()
  await submit.waitFor({ state: 'visible', timeout: 30000 })
  await submit.click()

  // Wait for form submission to complete (success or error)
  await page.waitForTimeout(2000)
}

export async function loginUserWithEmailPassword(
  page: Page,
  opts: { email: string; password: string; callbackPath?: string },
) {
  const { email, password, callbackPath } = opts
  const url = callbackPath
    ? `/auth/sign-in?callbackUrl=${encodeURIComponent(callbackPath)}`
    : '/auth/sign-in'

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })

  const emailInput = page.getByRole('textbox', { name: /email/i })
  const passwordInput = page.getByRole('textbox', { name: /password/i })
  await emailInput.first().fill(email)
  await passwordInput.first().fill(password)

  const submit = page.getByRole('button', { name: /submit|sign in|log in/i }).first()
  await submit.click()
}

export { mockSubscriptionCreatedWebhook }



