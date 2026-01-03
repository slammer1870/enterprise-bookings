import { expect, type Page } from '@playwright/test'
import { waitForServerReady } from './helpers/server.js'

/**
 * Helper to save an object and wait for navigation, with fallback to extract ID from response.
 * Works for class-options, lessons, and other Payload admin objects.
 */
export async function saveObjectAndWaitForNavigation(
  page: Page,
  options: {
    apiPath: string
    expectedUrlPattern: RegExp
    collectionName: string
  },
): Promise<void> {
  const { apiPath, expectedUrlPattern, collectionName } = options
  const saveButton = page.getByRole('button', { name: 'Save' })

  await saveButton.waitFor({ state: 'visible', timeout: 30000 })
  await expect(saveButton)
    .toBeEnabled({ timeout: 10000 })
    .catch(() => page.waitForTimeout(1000))

  const navigationTimeout = process.env.CI ? 120000 : 60000

  const responsePromise = page
    .waitForResponse(
      (response: any) => {
        const url = response.url()
        const method = response.request().method()
        const status = response.status()
        return method === 'POST' && url.includes(apiPath) && !url.includes(`${apiPath}/`) && status === 201
      },
      { timeout: navigationTimeout },
    )
    .catch(() => null)

  await saveButton.click()

  let objectId: number | null = null
  try {
    const response = await responsePromise
    if (response) {
      const responseBody: any = await response.json()
      objectId = responseBody?.doc?.id ?? responseBody?.id ?? null
    }
  } catch {
    // ignore
  }

  await page.waitForLoadState('load', { timeout: process.env.CI ? 30000 : 15000 }).catch(() => {})

  try {
    await expect(page).toHaveURL(expectedUrlPattern, {
      timeout: process.env.CI ? 30000 : 10000,
    })
  } catch {
    if (objectId !== null) {
      const editUrl = `/admin/collections/${collectionName}/${objectId}`
      await page.goto(editUrl, { waitUntil: 'domcontentloaded', timeout: navigationTimeout })
      await expect(page).toHaveURL(editUrl, { timeout: process.env.CI ? 30000 : 10000 })
    } else {
      throw new Error(
        `Failed to navigate to ${collectionName} edit page and could not extract ID. Current URL: ${page.url()}`,
      )
    }
  }
}

/**
 * Ensure we're logged in as Payload admin.
 * Handles "create first user" and normal login flows.
 */
export async function ensureAdminLoggedIn(page: Page) {
  const adminEmail = `admin@example.com`
  const adminPassword = 'password123'

  await waitForServerReady(page.context().request)
  await page.goto('/admin', { waitUntil: 'domcontentloaded', timeout: 120000 })
  // Allow client-side redirects (/admin -> /admin/login or /admin/create-first-user) to settle.
  await page
    .waitForURL(/\/admin\/(login|create-first-user|collections|logout|account|reset-password)/, {
      timeout: 10000,
    })
    .catch(() => {})

  const waitForAdminUI = async (timeoutMs: number) => {
    const startedAt = Date.now()
    while (Date.now() - startedAt < timeoutMs) {
      const hasCollectionsLink = (await page.locator('a[href^="/admin/collections"]').count()) > 0
      const hasLogoutLink = (await page.locator('a[href="/admin/logout"]').count()) > 0
      if (hasCollectionsLink || hasLogoutLink) return
      await page.waitForTimeout(500)
    }

    throw new Error(`Timed out waiting for Payload admin UI after ${timeoutMs}ms. Current URL: ${page.url()}`)
  }

  const isAdminUIVisible = async () => {
    const hasCollectionsLink = (await page.locator('a[href^="/admin/collections"]').count()) > 0
    const hasLogoutLink = (await page.locator('a[href="/admin/logout"]').count()) > 0
    return hasCollectionsLink || hasLogoutLink
  }

  const fillStable = async (locatorFactory: () => ReturnType<Page['locator']>, value: string) => {
    const attempts = process.env.CI ? 5 : 3
    for (let i = 0; i < attempts; i++) {
      // If we got redirected into the admin shell mid-fill, treat as success.
      if (await isAdminUIVisible()) return
      const loc = locatorFactory().first()
      try {
        await loc.waitFor({ state: 'attached', timeout: process.env.CI ? 20000 : 10000 })
        await (loc as any).scrollIntoViewIfNeeded?.().catch(() => {})
        await loc.fill(value)
        return
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        // React can re-render inputs during validation; retry when the element detaches.
        if (/detached|not attached|Target page|context or browser has been closed/i.test(msg) && i < attempts - 1) {
          await page.waitForTimeout(250)
          continue
        }
        throw err
      }
    }
  }

  await waitForAdminUI(1500).catch(() => {})
  try {
    await waitForAdminUI(1)
    return
  } catch {
    // continue
  }

  const createFirstUserHeading = page.getByRole('heading', { name: /^Welcome$/i })
  const loginButton = page.getByRole('button', { name: /log\s*in|login|sign\s*in/i })
  const emailInput = page.getByRole('textbox', { name: /^Email\s*\*?$/i })
  const passwordInput = page.getByRole('textbox', { name: /^Password\s*\*?$/i })

  const isCreateFirstUserRoute = () => {
    try {
      const u = new URL(page.url())
      return u.pathname.includes('/admin/create-first-user')
    } catch {
      return page.url().includes('/admin/create-first-user')
    }
  }

  const isLoginRoute = () => {
    try {
      const u = new URL(page.url())
      return u.pathname.includes('/admin/login')
    } catch {
      return page.url().includes('/admin/login')
    }
  }

  const fillCreateFirstUserForm = async (): Promise<boolean> => {
    // If we're already in the admin shell, don't try to fill create-first-user fields.
    if (await isAdminUIVisible()) return true

    // Guard: if we're not actually on the create-first-user form, don't try to fill "Confirm Password".
    // This avoids hanging on /admin/login where the field doesn't exist.
    const hasCreateFirstUserForm =
      (await page.locator('input[name="newPassword"], input[name="confirmPassword"]').count()) > 0 ||
      (await page.getByRole('textbox', { name: /^New Password$/i }).count()) > 0

    if (!isCreateFirstUserRoute() && !hasCreateFirstUserForm) {
      return false
    }

    // Some apps require a name on the users collection (NOT NULL in DB).
    const nameFieldCandidates = page.locator('input[name="name"], input#field-name')
    if ((await nameFieldCandidates.count()) > 0) {
      await nameFieldCandidates.first().fill('Admin')
    } else {
      const nameByRole = page.getByRole('textbox', { name: /^Name\s*\*?$/i })
      if ((await nameByRole.count()) > 0) {
        await nameByRole.first().fill('Admin')
      }
    }

    // Prefer stable selectors if role/name matching differs across Payload versions.
    const emailField =
      (await page.locator('input[name="email"]').count()) > 0
        ? page.locator('input[name="email"]').first()
        : emailInput.first()
    await emailField.fill(adminEmail)

    // Prefer role/name selectors ("New Password" / "Confirm Password") which are more stable across Payload versions.
    const newPasswordByRole = page.getByRole('textbox', { name: /^New Password$/i })
    const confirmByRole = page.getByRole('textbox', { name: /^Confirm Password$/i })
    const passwordFieldCandidates = page.locator(
      'input[name="newPassword"], input#field-newPassword, input[name="password"][aria-label*="New Password"], input#field-password[aria-label*="New Password"]',
    )
    const confirmFieldCandidates = page.locator(
      'input[name="confirmPassword"], input[name="passwordConfirm"], input#field-confirmPassword, input#field-passwordConfirm',
    )

    await fillStable(
      () => ((page as any).getByRole ? newPasswordByRole : passwordFieldCandidates) as any,
      adminPassword,
    )
    await fillStable(
      () => ((page as any).getByRole ? confirmByRole : confirmFieldCandidates) as any,
      adminPassword,
    )

    const emailVerified = page.getByRole('checkbox', { name: /^Email Verified/i })
    if ((await emailVerified.count()) > 0) {
      await emailVerified.first().setChecked(true)
    }

    // Some apps require role selection (and "User" may not have admin access).
    // Try to select an Admin-capable role if it exists; otherwise select the first available option.
    const roleComboByRole = page.getByRole('combobox', { name: /role/i })
    // Use XPath to avoid relying on Locator.filter()/Locator.locator() (type defs vary across setups).
    const roleComboByXPath = page.locator(
      'xpath=//*[normalize-space(.)="Role" or normalize-space(.)="Role *"]/following::*[@role="combobox"][1]',
    )

    const roleCombo =
      (await roleComboByRole.count()) > 0
        ? roleComboByRole.first()
        : (await roleComboByXPath.count()) > 0
          ? roleComboByXPath.first()
          : null

    if (roleCombo !== null) {
      await roleCombo.click().catch(() => {})
      const adminOption = page.getByRole('option', { name: /admin/i })
      if ((await adminOption.count()) > 0) {
        await adminOption.first().click()
      } else {
        const firstOption = page.getByRole('option').first()
        if ((await firstOption.count()) > 0) {
          await firstOption.click().catch(() => {})
        }
      }
    }

    const createButton = page.getByRole('button', { name: /^Create$/i })

    // Wait for the API response so we can distinguish:
    // - fresh DB success => proceed
    // - user already exists / validation error => fall back to normal login
    const res = await Promise.all([
      page
        .waitForResponse(
          (r) =>
            r.request().method() === 'POST' &&
            (r.url().includes('/api/users/first-register') || r.url().includes('/admin/create-first-user')),
          { timeout: 30000 },
        )
        .catch(() => null),
      createButton.click(),
    ]).then(([response]) => response)

    if (res && res.status() >= 400) {
      return false
    }

    // Allow redirect / UI update to settle after submit.
    await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {})
    return true
  }

  // We avoid forcing /admin/login -> /admin/create-first-user.
  // That navigation is a common source of flakiness once a user exists (it can briefly render and re-render the form).

  if (
    isCreateFirstUserRoute() ||
    (await createFirstUserHeading.isVisible({ timeout: 1500 }).catch(() => false))
  ) {
    const didCreate = await fillCreateFirstUserForm()
    if (!didCreate) {
      // Common case in CI: user already exists, but we navigated to create-first-user anyway.
      // Fall back to normal login.
      await page.goto('/admin/login', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {})
    }
    // After creating the first user, Payload may redirect to /admin/login briefly.
    await page.waitForTimeout(500)
  }

  const clickLoginSubmit = async () => {
    // Prefer semantic button label, fall back to form submit button.
    if (await loginButton.isVisible({ timeout: 500 }).catch(() => false)) {
      await loginButton.click()
      return
    }
    const submit = page.locator('button[type="submit"]').first()
    if ((await submit.count()) > 0) {
      await submit.click()
    }
  }

  const loginAndWaitForAdminUI = async (): Promise<void> => {
    // If we're not on the login page, navigating to it is safe and makes selectors consistent.
    if (!isLoginRoute()) {
      await page.goto('/admin/login', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {})
    }

    // Payload login markup varies across versions/configs; prefer robust selectors.
    const emailFieldCandidates = page.locator(
      'input[name="email"], input#field-email, input[type="email"], input[autocomplete="email"]',
    )
    const passwordFieldCandidates = page.locator(
      'input[name="password"], input#field-password, input[type="password"], input[autocomplete="current-password"]',
    )

    const emailField =
      (await emailFieldCandidates.count()) > 0 ? emailFieldCandidates.first() : emailInput.first()
    const passwordField =
      (await passwordFieldCandidates.count()) > 0
        ? passwordFieldCandidates.first()
        : passwordInput.first()

    await fillStable(() => emailField, adminEmail)
    await fillStable(() => passwordField, adminPassword)

    // Best practice: wait for the login network response instead of relying on UI timing.
    const loginResponsePromise = page
      .waitForResponse(
        (r) => r.request().method() === 'POST' && r.url().includes('/api/users/login'),
        { timeout: 30000 },
      )
      .catch(() => null)

    await clickLoginSubmit()
    const loginRes = await loginResponsePromise

    // If login succeeded, proceed to admin shell.
    if (loginRes && loginRes.status() === 200) {
      await page.goto('/admin', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {})
      await waitForAdminUI(60000)
      return
    }

    // If login failed, we might be on a fresh DB where no user exists yet.
    // Try the create-first-user flow once; if it doesn't apply, throw a useful error.
    await page.goto('/admin/create-first-user', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    }).catch(() => {})

    const didCreate = await fillCreateFirstUserForm().catch(() => false)
    if (didCreate) {
      await page.goto('/admin', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {})
      await waitForAdminUI(60000)
      return
    }

    const txt = loginRes ? await loginRes.text().catch(() => '') : ''
    throw new Error(
      `Admin login failed and create-first-user did not apply. ` +
        `Current URL: ${page.url()}. Login status: ${loginRes?.status() ?? 'no response'} ${txt}`,
    )
  }

  if (await loginButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await loginAndWaitForAdminUI().catch(() => {})
  }

  // If create-first-user raced (multiple workers) or didn't auto-login, fall back to explicit login.
  await waitForAdminUI(5000).catch(async () => {
    await loginAndWaitForAdminUI()
  })

  await waitForAdminUI(60000)
}



