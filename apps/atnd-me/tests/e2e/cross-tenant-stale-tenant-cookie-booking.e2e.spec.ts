/**
 * Regression: stale `tenant-slug` cookie from tenant A should not block booking on tenant B.
 *
 * Scenario:
 * - User is logged in with tenant context for tenant A.
 * - Root-domain `tenant-slug=tenantA` cookie remains set (simulates cross-host navigation in real browsers).
 * - User visits tenant B booking page and clicks "Book".
 *
 * Expected:
 * - Booking attempt should succeed (no redirect to `/` / home).
 */
import { test, expect } from './helpers/fixtures'
import { navigateToTenant } from './helpers/subdomain-helpers'
import { loginAsRegularUser } from './helpers/auth-helpers'
import { createTestEventType, createTestTimeslot, getPayloadInstance } from './helpers/data-helpers'

test.describe('Cross-tenant booking: stale tenant cookie', () => {
  test('does not redirect home when tenant-slug cookie is stale', async ({ page, testData }) => {
    // PW_E2E_FAST caps navigation timeout at 20 s; under server load this page can exceed
    // that, so give this test more headroom.
    test.setTimeout(90_000)
    const tenantA = testData.tenants[0]!
    const tenantB = testData.tenants[1]!
    const user = testData.users.user1
    const workerIndex = testData.workerIndex

    const hasSetup = Boolean(tenantA?.slug && tenantB?.slug && tenantA?.id && tenantB?.id && user?.email)
    if (!hasSetup) throw new Error('Missing test setup (tenant/user required)')

    // Create a pay-at-door style timeslot (no paymentMethods) in tenant B so booking is immediate.
    const classOption = await createTestEventType(
      tenantB.id,
      'Cross Tenant Stale Cookie Booking Test',
      10,
      undefined,
      workerIndex
    )

    const startTime = new Date()
    startTime.setHours(12, 0, 0, 0)
    startTime.setDate(startTime.getDate() + 2 + workerIndex)
    const endTime = new Date(startTime)
    endTime.setHours(13, 0, 0, 0)

    const lesson = await createTestTimeslot(tenantB.id, classOption.id, startTime, endTime, undefined, true)

    // Ensure user1 is a regular user (prior tests may have left global role as admin).
    const payload = await getPayloadInstance()
    await payload.update({
      collection: 'users',
      id: user.id,
      data: {
        tenants: [{ tenant: tenantA.id, roles: ['user'] }],
        role: ['user'],
      } as Parameters<typeof payload.update>[0]['data'],
      overrideAccess: true,
    })

    // Log in against tenant B so the auth session cookies are present on tenantB.localhost.
    // Then clear the tenant-scoped cookie on tenant B and replace it with a stale root cookie
    // (tenant A), simulating cross-host navigation with leftover tenant context.
    // Use loginAsRegularUser (not loginAsRegularUserViaApi) so the sign-in goes through the
    // tenant B host — this ensures Better Auth scopes the session token to the tenant domain.
    await loginAsRegularUser(page, 1, user.email, 'password', { tenantSlug: tenantB.slug })

    // Clear tenantB-scoped tenant-slug cookie so tenantB requests only "see" the stale root cookie.
    await page.context().addCookies([
      {
        name: 'tenant-slug',
        value: '',
        url: `http://${tenantB.slug}.localhost:3000/`,
        expires: 1,
      },
    ])

    // Set stale parent-domain tenant-slug cookie (mirrors production `.example.com` scope).
    await page.context().addCookies([
      {
        name: 'tenant-slug',
        value: tenantA.slug,
        domain: '.localhost',
        path: '/',
      },
    ])

    // Navigate to tenant B booking page and complete booking.
    // Use an explicit 40 s timeout so PW_E2E_FAST's 20 s nav timeout doesn't fire on a
    // loaded server — navigateToTenant uses the Playwright config default which is tighter.
    await page
      .goto(`http://${tenantB.slug}.localhost:3000/bookings/${lesson.id}`, {
        waitUntil: 'domcontentloaded',
        timeout: 40_000,
      })
      .catch(() => null)
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => null)

    // Sanity: we should be on tenant B host.
    expect(new URL(page.url()).hostname).toBe(`${tenantB.slug}.localhost`)

    await expect(page.getByText(/select quantity/i).first()).toBeVisible({ timeout: 15000 })

    const bookBtn = page.getByRole('button', { name: /^(book|confirm)\b/i }).first()
    await expect(bookBtn).toBeVisible({ timeout: 10000 })
    await expect(bookBtn).toBeEnabled()

    await Promise.all([
      page.waitForURL(/\/success|\/success\//).catch(() => null),
      bookBtn.click(),
    ])

    await expect(page.getByRole('heading', { name: /thank you/i })).toBeVisible({ timeout: 15000 })
  })
})

