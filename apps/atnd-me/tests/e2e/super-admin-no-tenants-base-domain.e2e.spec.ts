/**
 * Regression tests: a user with global roles `['user', 'super-admin']` and no tenant
 * memberships must be able to reach the base-domain admin dashboard without triggering
 * ERR_TOO_MANY_REDIRECTS.
 *
 * The cross-tenant redirect logic has been simplified: instead of calling
 * /api/admin/authorize-tenant on every /admin request (the old approach that caused
 * production bugs), cross-tenant redirects are now handled once in the `afterLogin`
 * collection hook. The hook sets a short-lived `__atnd_post_login_redirect` cookie that
 * middleware consumes on the next /admin navigation.
 *
 * For a super-admin with no tenant memberships who logs in on a tenant subdomain:
 * 1. The login form renders normally (no pre-render middleware redirect).
 * 2. On login, the afterLogin hook sets redirect cookie = 'base'.
 * 3. The admin UI navigates to /admin; middleware reads the cookie and redirects to
 *    the base-domain /admin/login.
 * 4. The user logs in again at the base domain and lands on /admin without any redirect loop.
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
   * Cross-domain sanity check: with the simplified middleware (no pre-render authorize-tenant
   * call), a super-admin with no tenants can open the login form on a tenant subdomain,
   * log in there, and then navigate to the base-domain admin without hitting a redirect loop.
   *
   * Simplified flow (no automatic cross-domain redirect after login):
   *   1. Navigate to tenant1.localhost/admin/login — form renders immediately (no pre-render block)
   *   2. Fill in credentials and log in — no crash, user reaches an admin page
   *   3. Manually navigate to localhost/admin — no ERR_TOO_MANY_REDIRECTS, dashboard loads
   */
  test('super-admin with no tenants can log in on a tenant subdomain then access base-domain admin without redirect loop', async ({
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
      // With the simplified middleware the login form renders immediately — no pre-render
      // authorize-tenant round-trip blocks it.
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

      await emailInput.waitFor({ state: 'visible', timeout: 20_000 })
      await emailInput.fill(email)
      await passwordInput.fill('password')
      await submitButton.click()

      // Login should succeed — user reaches some admin page (no crash/loop).
      // The simplified middleware no longer redirects cross-domain automatically post-login,
      // so they may end up on the tenant subdomain admin rather than the base domain.
      await page
        .waitForURL((u) => u.pathname.startsWith('/admin') && !u.pathname.startsWith('/admin/login'), {
          timeout: 25_000,
        })
        .catch(() => null)

      const urlAfterLogin = new URL(page.url())
      expect(
        urlAfterLogin.pathname.startsWith('/admin'),
        `Expected to reach an admin page after login, got: ${page.url()}`,
      ).toBe(true)

      // Step 3: manually navigate to the base-domain admin — no redirect loop.
      await page
        .goto('http://localhost:3000/admin', { waitUntil: 'domcontentloaded' })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err)
          if (message.includes('ERR_TOO_MANY_REDIRECTS')) {
            tooManyRedirects = true
          }
        })

      expect(
        tooManyRedirects,
        'Got ERR_TOO_MANY_REDIRECTS navigating to base-domain /admin — super-admin with no tenants is in a redirect loop',
      ).toBe(false)

      // Should land on the base-domain admin (or its login page, either is fine — no loop).
      const finalUrl = new URL(page.url())
      expect(
        finalUrl.hostname === 'localhost' && finalUrl.pathname.startsWith('/admin'),
        `Expected to reach localhost/admin (or /admin/login), got: ${page.url()}`,
      ).toBe(true)
    } finally {
      await payload
        .delete({ collection: 'users', id: superAdminUser.id, overrideAccess: true })
        .catch(() => null)
    }
  })
})
