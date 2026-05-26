/**
 * Staff (`role: staff`) must reach the Payload admin dashboard on a tenant host.
 *
 * Uses a hostname under `*.127.0.0.1.nip.io` so DNS resolves to loopback while the Host header
 * is not `*.localhost`, which exercises the same middleware branch as production custom domains.
 * Requires outbound DNS (nip.io) — same as typical CI/dev machines.
 *
 * Run via Turborepo from the monorepo root (recommended):
 *   pnpm test:e2e:atnd-me -- staff-admin-custom-domain
 *   E2E_USE_PROD=false pnpm test:e2e:atnd-me -- staff-admin-custom-domain
 *
 * Playwright treats CLI file arguments as regex; use a substring like `staff-admin-custom-domain`
 * rather than the full filename (unescaped `.` would match any character).
 */
import { test, expect } from './helpers/fixtures'
import { loginAsStaff } from './helpers/auth-helpers'
import { createTestTenant, createTestUser, getPayloadInstance } from './helpers/data-helpers'
import { isNipIoDnsAvailable } from './helpers/dns-helpers'
import { e2eSlowTestTimeout } from './helpers/timeouts'
import type { Page } from '@playwright/test'

async function submitAdminLogin(page: Page, email: string, password = 'password') {
  const emailInput = page.getByRole('textbox', { name: /^email/i }).first()
  const passwordInput = page
    .getByLabel(/^password/i)
    .or(page.locator('input[type="password"]'))
    .first()
  const submitButton = page
    .getByRole('button', { name: /login|sign in/i })
    .or(page.locator('button[type="submit"]'))
    .first()

  await expect(emailInput).toBeVisible()
  await expect(passwordInput).toBeVisible()
  await emailInput.fill(email)
  await passwordInput.fill(password)
  await expect(submitButton).toBeEnabled()
  await submitButton.click()
}

test.describe('Staff admin access (custom domain host)', () => {
  test.describe.configure({ timeout: e2eSlowTestTimeout() })

  let staffOrigin: string
  let otherOrigin: string
  let staffEmail: string
  let tenant1Slug: string
  let nipIoAvailable = false

  test.beforeAll(async ({ testData }) => {
    nipIoAvailable = await isNipIoDnsAvailable()

    const payload = await getPayloadInstance()
    const w = testData.workerIndex
    const stamp = Date.now()
    const host1 = nipIoAvailable ? `e2e-staff-${w}-${stamp}.127.0.0.1.nip.io` : undefined
    const host2 = nipIoAvailable ? `e2e-staff-oth-${w}-${stamp}.127.0.0.1.nip.io` : undefined
    if (host1) staffOrigin = `http://${host1}:3000`
    if (host2) otherOrigin = `http://${host2}:3000`

    const slug1 = `staff-cd-1-${w}-${stamp}`
    const slug2 = `staff-cd-2-${w}-${stamp}`
    tenant1Slug = slug1

    const tenant1 = await createTestTenant('E2E staff custom domain 1', slug1, host1)
    if (host2) {
      await createTestTenant('E2E staff custom domain 2', slug2, host2)
    }

    staffEmail = `staffcd${w}${stamp}@test.com`
    await createTestUser(staffEmail, 'password', 'E2E Staff CD', ['staff'])
    await payload.update({
      collection: 'users',
      where: { email: { equals: staffEmail } },
      data: {
        tenants: [{ tenant: tenant1.id }],
        registrationTenant: tenant1.id,
      },
      overrideAccess: true,
    })
  })

  test('staff can open the admin dashboard on the tenant custom domain', async ({ page, request }) => {
    test.skip(!nipIoAvailable, 'nip.io DNS is not available (outbound DNS required for custom-domain e2e)')

    await loginAsStaff(page, staffEmail, { request, password: 'password', adminOrigin: staffOrigin })
    const url = new URL(page.url())
    expect(url.origin).toBe(staffOrigin)
    expect(url.pathname.startsWith('/admin')).toBe(true)
    expect(url.pathname.startsWith('/admin/login')).toBe(false)
  })

  test('staff can open the admin dashboard on the tenant subdomain (localhost)', async ({
    page,
    request,
  }) => {
    const subdomainOrigin = `http://${tenant1Slug}.localhost:3000`
    await loginAsStaff(page, staffEmail, {
      request,
      password: 'password',
      adminOrigin: subdomainOrigin,
    })
    await page.goto(`${subdomainOrigin}/admin`, { waitUntil: 'domcontentloaded' })
    await page.waitForURL(
      (u) => u.pathname.startsWith('/admin') && !u.pathname.startsWith('/admin/login'),
      { timeout: 25_000 }
    )
    const url = new URL(page.url())
    expect(url.hostname).toBe(`${tenant1Slug}.localhost`)
  })

  test('staff for tenant A cannot use the admin dashboard on tenant B custom domain', async ({
    page,
  }) => {
    test.skip(!nipIoAvailable, 'nip.io DNS is not available (outbound DNS required for custom-domain e2e)')

    const hostOther = new URL(otherOrigin).hostname
    await page.goto(`${otherOrigin}/admin/login`, { waitUntil: 'domcontentloaded' })
    await submitAdminLogin(page, staffEmail)
    await page
      .waitForURL(
        (u) =>
          (u.hostname === hostOther && u.pathname.startsWith('/admin/login')) ||
          (u.hostname === 'localhost' && u.pathname.startsWith('/admin')),
        { timeout: 15_000 }
      )
      .catch(() => null)

    const url = new URL(page.url())
    const stillOnOtherLogin = url.hostname === hostOther && url.pathname.startsWith('/admin/login')
    const redirectedToRootAdmin = url.hostname === 'localhost' && url.pathname.startsWith('/admin')
    const wronglyOnOtherDashboard =
      url.hostname === hostOther &&
      url.pathname.startsWith('/admin') &&
      !url.pathname.startsWith('/admin/login')

    expect(wronglyOnOtherDashboard).toBe(false)
    expect(stillOnOtherLogin || redirectedToRootAdmin).toBe(true)
  })
})
