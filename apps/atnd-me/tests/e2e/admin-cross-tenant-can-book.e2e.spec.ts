import { test, expect } from './helpers/fixtures'
import { navigateToTenant } from './helpers/subdomain-helpers'
import { loginAsRegularUser } from './helpers/auth-helpers'
import { createTestEventType, createTestTimeslot, getPayloadInstance } from './helpers/data-helpers'

test.describe('Admin cross-tenant booking', () => {
  test('tenant B admin can book a tenant A timeslot', async ({ page, testData }) => {
    const tenantA = testData.tenants[0]!
    const tenantB = testData.tenants[1]!
    const adminB = testData.users.tenantAdmin2
    const workerIndex = testData.workerIndex

    if (!tenantA?.slug || !tenantB?.slug || !tenantA?.id || !tenantB?.id || !adminB?.email) {
      throw new Error('Test setup missing tenantA/tenantB/adminB')
    }

    // Create a pay-at-door (no paymentMethods configured) timeslot in tenant A.
    const classOption = await createTestEventType(
      tenantA.id,
      'Admin Cross-Tenant Booking Test',
      10,
      undefined,
      workerIndex
    )

    const startTime = new Date()
    startTime.setHours(12, 0, 0, 0)
    startTime.setDate(startTime.getDate() + 2 + workerIndex)
    const endTime = new Date(startTime)
    endTime.setHours(13, 0, 0, 0)

    const lesson = await createTestTimeslot(tenantA.id, classOption.id, startTime, endTime, undefined, true)

    // Ensure tenant B admin is also a member of tenant A so cross-tenant booking is authorized.
    const payload = await getPayloadInstance()
    await payload.update({
      collection: 'users',
      where: { email: { equals: adminB.email } },
      data: {
        tenants: [{ tenant: tenantA.id }, { tenant: tenantB.id }],
        // Better Auth's tenant resolution uses `registrationTenant`, so set it to
        // the target tenant we sign into (tenant A) for this cross-tenant booking test.
        registrationTenant: tenantA.id,
        // tenantRoles is now the authoritative per-tenant model used by resolveTenantAdminTenantIds.
        // Without including tenantA here, the access control would only see tenant B
        // and deny the timeslot lookup (NOT_FOUND → redirect to /).
        tenantRoles: [
          { tenant: tenantA.id, roles: ['admin'] },
          { tenant: tenantB.id, roles: ['admin'] },
        ],
      } as Parameters<typeof payload.update>[0]['data'],
      overrideAccess: true,
    })

    // Login as tenant B admin, but ensure cookies are scoped to the tenant A host
    // so the booking route resolves tenant context from tenant A.
    await loginAsRegularUser(page, 1, adminB.email, 'password', { tenantSlug: tenantA.slug })

    await navigateToTenant(page, tenantA.slug, `/bookings/${lesson.id}`)
    await page.waitForLoadState('domcontentloaded').catch(() => null)

    // Booking page can sometimes redirect to /success if the hold is created/confirmed
    // faster than the UI settles. If we're already on success, assert and exit early.
    const successHeading = page.getByRole('heading', { name: /thank you/i })
    const successAlreadyVisible = await successHeading.isVisible().catch(() => false)
    if (successAlreadyVisible) {
      await expect(successHeading).toBeVisible({ timeout: 5000 })
      await expect(page.getByText(/your booking has been confirmed/i)).toBeVisible({ timeout: 5000 })
      return
    }

    await expect(
      page.getByText(/select quantity|number of slots|choose how many slots/i).first()
    ).toBeVisible({ timeout: 15000 })

    const bookBtn = page.getByRole('button', { name: /^book\b/i }).first()
    await expect(bookBtn).toBeVisible({ timeout: 10000 })
    await expect(bookBtn).toBeEnabled()

    await Promise.all([
      page.waitForURL(/\/success|\/success\//).catch(() => null),
      bookBtn.click(),
    ])

    await expect(page.getByRole('heading', { name: /thank you/i })).toBeVisible({ timeout: 15000 })
  })
})

