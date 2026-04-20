/**
 * E2E: Header navbar reflects Better Auth session (Sign in vs account menu).
 * Uses a desktop viewport so auth is in the main bar when the CMS navbar includes links
 * (mobile layout hides auth behind the burger until the drawer opens).
 */
import { test, expect } from './helpers/fixtures'
import { loginAsRegularUserViaApi } from './helpers/auth-helpers'

test.describe('Navbar auth state', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
  })

  test('shows Sign in when anonymous', async ({ page, testData }) => {
    const tenant = testData.tenants[0]!
    const origin = `http://${tenant.slug}.localhost:3000`

    await page.goto(`${origin}/home`, { waitUntil: 'domcontentloaded' })

    const header = page.locator('header')
    await expect(header.getByRole('link', { name: 'Sign in' })).toBeVisible({ timeout: 20_000 })
    await expect(header.getByLabel('Open account menu')).toHaveCount(0)
  })

  test('shows account menu when signed in', async ({ page, testData }) => {
    const tenant = testData.tenants[0]!
    const origin = `http://${tenant.slug}.localhost:3000`

    await loginAsRegularUserViaApi(page, testData.users.user1.email, 'password', {
      baseURL: origin,
      tenantSlug: tenant.slug,
    })

    await page.goto(`${origin}/home`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle').catch(() => null)

    const header = page.locator('header')
    // `<summary>` may not always map to role "button" in the a11y tree; `aria-label` is stable.
    await expect(header.getByLabel('Open account menu')).toBeVisible({
      timeout: 20_000,
    })
    await expect(header.getByRole('link', { name: 'Sign in' })).toHaveCount(0)
  })

  test('navbar shows Sign in after user logs out from account menu', async ({ page, testData }) => {
    const tenant = testData.tenants[0]!
    const origin = `http://${tenant.slug}.localhost:3000`

    await loginAsRegularUserViaApi(page, testData.users.user1.email, 'password', {
      baseURL: origin,
      tenantSlug: tenant.slug,
    })

    await page.goto(`${origin}/home`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle').catch(() => null)

    const header = page.locator('header')
    await expect(header.getByLabel('Open account menu')).toBeVisible({ timeout: 20_000 })

    await header.getByLabel('Open account menu').click()
    const logOut = header.locator('details').getByRole('button', { name: /^log out$/i })
    await expect(logOut).toBeVisible({ timeout: 10_000 })
    await logOut.click()

    // signOut → refresh → router.push('/'); navbar uses client useSession() so it updates without reload.
    await page.waitForURL((url) => new URL(url).pathname === '/', { timeout: 30_000 })

    const headerAfterLogout = page.locator('header')
    await expect(headerAfterLogout.getByRole('link', { name: 'Sign in' })).toBeVisible({
      timeout: 20_000,
    })
    await expect(headerAfterLogout.getByLabel('Open account menu')).toHaveCount(0)
  })
})
