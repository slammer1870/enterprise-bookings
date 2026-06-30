/**
 * Regression tests: a user with global roles `['user', 'super-admin']` and no tenant
 * memberships must be able to reach the base-domain admin dashboard without triggering
 * ERR_TOO_MANY_REDIRECTS.
 *
 * Root cause of production bug: middleware calls `/api/admin/authorize-tenant` on every
 * /admin request. For a super-admin it returns 204 (no X-Tenant-Redirect). When Payload's
 * own admin-access function also rejects the session (e.g. because the Payload JWT doesn't
 * include the super-admin role or `usersPayloadAdminAccess` is too restrictive), Payload
 * bounces the browser to /admin/login. Middleware then sees an authenticated user on
 * /admin/login and redirects back to /admin, completing the redirect loop.
 *
 * Fix: ensure the Payload admin access function grants access to users whose JWT role
 * includes 'super-admin', and that middleware's loop-break guard (Referer: /admin) fires
 * before bouncing an already-redirected session.
 */
import { test, expect } from './helpers/fixtures'
import { loginToAdminPanel } from './helpers/auth-helpers'
import { createTestUser, getPayloadInstance } from './helpers/data-helpers'

test.describe('Super-admin with no tenants can access base-domain admin dashboard', () => {
  test.setTimeout(90_000)

  /**
   * Primary regression check: a user whose global role array contains both 'user' and
   * 'super-admin' but has zero tenant memberships must land on /admin (not loop).
   */
  test('user with roles [user, super-admin] and no tenants reaches base-domain /admin without redirect loop', async ({
    page,
    request,
  }) => {
    const stamp = Date.now()
    const email = `superadmin-notenant-${stamp}@test.com`
    const payload = await getPayloadInstance()

    // createTestUser sets the role and creates the user with no tenant memberships by default.
    const superAdminUser = await createTestUser(
      email,
      'password',
      'Super Admin No Tenants',
      ['user', 'super-admin'],
    )

    let tooManyRedirects = false

    try {
      // Attempt login using the API helper. This triggers the same middleware path as a
      // real browser navigating to http://localhost:3000/admin after authenticating.
      await loginToAdminPanel(page, email, 'password', { request }).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err)
        if (message.includes('ERR_TOO_MANY_REDIRECTS')) {
          tooManyRedirects = true
          return
        }
        throw err
      })

      // If we already caught a redirect loop above, the assertion below will fail.
      // Otherwise wait for the page to settle.
      if (!tooManyRedirects) {
        await page
          .waitForURL(
            (u) => u.pathname.startsWith('/admin') && !u.pathname.startsWith('/admin/login'),
            { timeout: 25_000 },
          )
          .catch(() => null)
      }

      expect(
        tooManyRedirects,
        'Got ERR_TOO_MANY_REDIRECTS — super-admin with no tenants is stuck in a redirect loop on base-domain /admin',
      ).toBe(false)

      const url = new URL(page.url())
      expect(
        url.pathname.startsWith('/admin') && !url.pathname.startsWith('/admin/login'),
        `Expected to land on /admin dashboard, got: ${page.url()}`,
      ).toBe(true)
    } finally {
      await payload
        .delete({ collection: 'users', id: superAdminUser.id, overrideAccess: true })
        .catch(() => null)
    }
  })

  /**
   * Complementary check: a user whose global role is only 'super-admin' (not combined
   * with 'user') and has no tenant memberships must also reach /admin without looping.
   */
  test('user with role [super-admin] only and no tenants reaches base-domain /admin without redirect loop', async ({
    page,
    request,
  }) => {
    const stamp = Date.now()
    const email = `superadmin-only-notenant-${stamp}@test.com`
    const payload = await getPayloadInstance()

    const superAdminUser = await createTestUser(
      email,
      'password',
      'Super Admin Only No Tenants',
      ['super-admin'],
    )

    let tooManyRedirects = false

    try {
      await loginToAdminPanel(page, email, 'password', { request }).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err)
        if (message.includes('ERR_TOO_MANY_REDIRECTS')) {
          tooManyRedirects = true
          return
        }
        throw err
      })

      if (!tooManyRedirects) {
        await page
          .waitForURL(
            (u) => u.pathname.startsWith('/admin') && !u.pathname.startsWith('/admin/login'),
            { timeout: 25_000 },
          )
          .catch(() => null)
      }

      expect(
        tooManyRedirects,
        'Got ERR_TOO_MANY_REDIRECTS — super-admin (role only) with no tenants is stuck in a redirect loop on base-domain /admin',
      ).toBe(false)

      const url = new URL(page.url())
      expect(
        url.pathname.startsWith('/admin') && !url.pathname.startsWith('/admin/login'),
        `Expected to land on /admin dashboard, got: ${page.url()}`,
      ).toBe(true)
    } finally {
      await payload
        .delete({ collection: 'users', id: superAdminUser.id, overrideAccess: true })
        .catch(() => null)
    }
  })

  /**
   * Negative check: an unauthenticated request to base-domain /admin must be redirected to
   * the login page (not reach the dashboard). A fresh page with no session cookies is used
   * so there is no ambiguity about whose credentials are in play.
   */
  test('unauthenticated user is redirected from base-domain /admin to the login page', async ({
    page,
  }) => {
    // Fresh page — no cookies, no session.
    let tooManyRedirects = false

    await page
      .goto('http://localhost:3000/admin', { waitUntil: 'domcontentloaded' })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err)
        if (message.includes('ERR_TOO_MANY_REDIRECTS')) {
          tooManyRedirects = true
          return
        }
        throw err
      })

    if (!tooManyRedirects) {
      await page.waitForTimeout(2000)
    }

    expect(
      tooManyRedirects,
      'Unauthenticated /admin navigation triggered ERR_TOO_MANY_REDIRECTS',
    ).toBe(false)

    const url = new URL(page.url())
    // Must end up on the login page (or anywhere outside the authenticated admin dashboard).
    expect(
      url.pathname.startsWith('/admin/login') || !url.pathname.startsWith('/admin'),
      `Expected redirect to /admin/login for unauthenticated user, got: ${page.url()}`,
    ).toBe(true)
  })

  /**
   * Cross-domain regression: a super-admin with no tenants who submits the login form on a
   * tenant subdomain must be redirected to the base-domain admin login by the system (not
   * manually navigated there), and must then be able to log in at the base domain without
   * triggering a redirect loop.
   *
   * Flow:
   *   1. Navigate to tenant1.localhost/admin/login (unauthenticated)
   *   2. Fill in credentials and submit
   *   3. System redirects to localhost/admin/login (base domain)
   *   4. Fill in credentials again and submit
   *   5. Land on localhost/admin dashboard — no ERR_TOO_MANY_REDIRECTS
   */
  test('super-admin with no tenants is redirected from tenant subdomain login to base-domain login and can log in there without redirect loop', async ({
    page,
    testData,
  }) => {
    const tenant1 = testData.tenants[0]!
    const stamp = Date.now()
    const email = `superadmin-crossdomain-${stamp}@test.com`
    const payload = await getPayloadInstance()

    const superAdminUser = await createTestUser(
      email,
      'password',
      'Super Admin Cross Domain',
      ['user', 'super-admin'],
    )

    let tooManyRedirects = false

    try {
      // Step 1: go to the tenant subdomain admin login page.
      await page.goto(
        `http://${tenant1.slug}.localhost:3000/admin/login`,
        { waitUntil: 'domcontentloaded' },
      )

      // Step 2: fill in credentials and submit.
      const emailInput = page
        .getByRole('textbox', { name: /email/i })
        .or(page.locator('input[type="email"]'))
        .first()
      const passwordInput = page
        .getByLabel(/password/i)
        .or(page.locator('input[type="password"]'))
        .first()
      const submitButton = page
        .getByRole('button', { name: /login|sign in/i })
        .or(page.locator('button[type="submit"]'))
        .first()

      await emailInput.waitFor({ state: 'visible', timeout: 15_000 })
      await emailInput.fill(email)
      await passwordInput.fill('password')
      await submitButton.click()

      // Step 3: system should redirect to the base-domain admin login.
      await page
        .waitForURL((u) => u.hostname === 'localhost', { timeout: 20_000 })
        .catch(() => null)

      const urlAfterSubmit = new URL(page.url())
      expect(
        urlAfterSubmit.hostname,
        `Expected system to redirect to base-domain (localhost) after login on tenant subdomain, but stayed on: ${page.url()}`,
      ).toBe('localhost')

      expect(
        urlAfterSubmit.pathname.startsWith('/admin/login'),
        `Expected to land on base-domain /admin/login, got: ${page.url()}`,
      ).toBe(true)

      // Step 4: fill in credentials at the base-domain login and submit.
      const emailInput2 = page
        .getByRole('textbox', { name: /email/i })
        .or(page.locator('input[type="email"]'))
        .first()
      const passwordInput2 = page
        .getByLabel(/password/i)
        .or(page.locator('input[type="password"]'))
        .first()
      const submitButton2 = page
        .getByRole('button', { name: /login|sign in/i })
        .or(page.locator('button[type="submit"]'))
        .first()

      await emailInput2.waitFor({ state: 'visible', timeout: 10_000 })
      await emailInput2.fill(email)
      await passwordInput2.fill('password')
      await submitButton2.click()

      // Step 5: expect to land on the base-domain admin dashboard without a redirect loop.
      await page
        .waitForURL(
          (u) =>
            u.hostname === 'localhost' &&
            u.pathname.startsWith('/admin') &&
            !u.pathname.startsWith('/admin/login'),
          { timeout: 25_000 },
        )
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err)
          if (message.includes('ERR_TOO_MANY_REDIRECTS')) {
            tooManyRedirects = true
          }
        })

      expect(
        tooManyRedirects,
        'Got ERR_TOO_MANY_REDIRECTS on base-domain admin login — super-admin with no tenants is in a redirect loop',
      ).toBe(false)

      const finalUrl = new URL(page.url())
      expect(
        finalUrl.hostname === 'localhost' &&
          finalUrl.pathname.startsWith('/admin') &&
          !finalUrl.pathname.startsWith('/admin/login'),
        `Expected to land on base-domain /admin dashboard, got: ${page.url()}`,
      ).toBe(true)
    } finally {
      await payload
        .delete({ collection: 'users', id: superAdminUser.id, overrideAccess: true })
        .catch(() => null)
    }
  })
})
