/**
 * Staff-only admin nav: Timeslots, Users, Emergency contacts.
 * Event Types and Home/analytics are hidden; /admin redirects to timeslots.
 */
import { test, expect } from './helpers/fixtures'
import { loginAsStaff } from './helpers/auth-helpers'
import { createTestUser, getPayloadInstance } from './helpers/data-helpers'

function tenantAdminOrigin(slug: string): string {
  return `http://${slug}.localhost:3000`
}

/** Staff often have no tenant selector; open the Payload nav if collapsed. */
async function ensureStaffNavOpen(page: import('@playwright/test').Page) {
  // On the timeslots list, the current collection may render as text (not a link).
  const timeslotsNav = page
    .getByRole('navigation')
    .getByText(/^timeslots$/i)
    .first()
  if (await timeslotsNav.isVisible().catch(() => false)) return

  const openMenuButton = page.getByRole('button', { name: /open\s+menu/i })
  if (await openMenuButton.isVisible().catch(() => false)) {
    await openMenuButton.click({ timeout: 10_000 }).catch(() => null)
  }

  await expect(timeslotsNav).toBeVisible({ timeout: 20_000 })
}

test.describe('Staff admin nav', () => {
  test.setTimeout(120_000)

  test('staff sidebar shows Timeslots, Users, Emergency contacts only', async ({
    page,
    request,
    testData,
  }) => {
    const tenant = testData.tenants[0]
    if (!tenant?.id || !tenant.slug) throw new Error('Expected tenant fixture')

    const payload = await getPayloadInstance()
    const w = testData.workerIndex
    const stamp = Date.now()
    const staffEmail = `staffnav${w}${stamp}@test.com`
    const staffUser = await createTestUser(
      staffEmail,
      'password',
      'E2E Staff Nav',
      ['staff'],
      tenant.id,
    )
    await payload.update({
      collection: 'users',
      id: staffUser.id,
      data: {
        tenants: [{ tenant: tenant.id, roles: ['staff'] }],
        registrationTenant: tenant.id,
        role: ['staff'],
      } as Parameters<typeof payload.update>[0]['data'],
      overrideAccess: true,
    })

    const adminOrigin = tenantAdminOrigin(tenant.slug)

    try {
      await loginAsStaff(page, staffEmail, {
        request,
        password: 'password',
        adminOrigin,
      })

      // Login lands on /admin; staff should be redirected to timeslots.
      await page.goto(`${adminOrigin}/admin`, {
        waitUntil: 'domcontentloaded',
        timeout: process.env.CI ? 120_000 : 60_000,
      })
      await page.waitForURL(
        (u) =>
          u.pathname.includes('/admin/collections/timeslots') ||
          (u.pathname.startsWith('/admin') && !u.pathname.startsWith('/admin/login')),
        { timeout: 30_000 },
      )

      // Allow redirect from dashboard → timeslots.
      if (!page.url().includes('/admin/collections/timeslots')) {
        await expect(page).toHaveURL(/\/admin\/collections\/timeslots/, { timeout: 15_000 })
      }

      await ensureStaffNavOpen(page)

      const nav = page.getByRole('navigation').first()
      await expect(nav.getByText(/^timeslots$/i).first()).toBeVisible({ timeout: 20_000 })
      await expect(nav.getByRole('link', { name: /^users$/i }).first()).toBeVisible({
        timeout: 15_000,
      })
      await expect(
        nav.getByRole('link', { name: /emergency contacts?/i }).first(),
      ).toBeVisible({ timeout: 15_000 })

      await expect(nav.getByRole('link', { name: /^event types?$/i })).toHaveCount(0)
      await expect(nav.getByRole('link', { name: /^home$/i })).toHaveCount(0)

      // Config / CMS collections must stay hidden.
      await expect(nav.getByRole('link', { name: /^pages$/i })).toHaveCount(0)
      await expect(nav.getByRole('link', { name: /^scheduler$/i })).toHaveCount(0)
      await expect(nav.getByRole('link', { name: /^tenants$/i })).toHaveCount(0)
      await expect(nav.getByRole('button', { name: /^products$/i })).toHaveCount(0)
      await expect(nav.getByRole('button', { name: /^website$/i })).toHaveCount(0)
    } finally {
      await payload
        .delete({ collection: 'users', id: staffUser.id, overrideAccess: true })
        .catch(() => null)
    }
  })
})
