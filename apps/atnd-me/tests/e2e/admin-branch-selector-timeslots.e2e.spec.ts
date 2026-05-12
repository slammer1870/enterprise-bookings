import type { Page } from '@playwright/test'
import { test, expect } from './helpers/fixtures'
import { loginAsTenantAdmin } from './helpers/auth-helpers'
import {
  createTestEventType,
  createTestTimeslot,
  getPayloadInstance,
} from './helpers/data-helpers'
import { uniqueClassName } from '@repo/testing-config/src/playwright'

function tenantAdminOrigin(slug: string): string {
  return `http://${slug}.localhost:3000`
}

async function setPayloadLocationCookieAndReload(page: Page, adminOrigin: string, locationId: number | null) {
  const value = locationId == null ? '' : String(locationId)

  // Use Playwright cookie APIs so the cookie is guaranteed to be sent on subsequent reload requests.
  // `timeslotsRead` parses `payload-location` as a positive int; empty string becomes `null`.
  await page.context().addCookies([
    { name: 'payload-location', value, url: `${adminOrigin}/` },
    { name: 'payload-location', value, url: `${adminOrigin}/admin/` },
    { name: 'payload-location', value, url: `${adminOrigin}/admin/collections/` },
  ])

  await page.reload({ waitUntil: 'domcontentloaded', timeout: process.env.CI ? 120_000 : 60_000 })
}

test.describe('Admin branch selector — timeslots list', () => {
  test.setTimeout(180_000)

  test('org admin filters timeslots by branch then returns to all sites', async ({
    page,
    request,
    testData,
  }) => {
    const tenant = testData.tenants[0]
    if (!tenant?.id || !tenant.slug) throw new Error('Expected tenant fixture')

    const payload = await getPayloadInstance()
    const w = testData.workerIndex
    const slugSuffix = w > 0 ? `-w${w}` : ''

    const findOrCreateLocation = async (slug: string, name: string) => {
      const existing = await payload.find({
        collection: 'locations',
        where: { and: [{ slug: { equals: slug } }, { tenant: { equals: tenant.id } }] },
        limit: 1,
        overrideAccess: true,
      })
      if (existing.docs[0]) {
        const doc = existing.docs[0]
        // Make the test re-runnable: if a previous run left the location inactive,
        // the branch selector endpoint filters by `active: true` and the selector won't render.
        if (!doc.active) {
          const updated = await payload.update({
            collection: 'locations',
            id: doc.id as number,
            data: { name, slug, tenant: tenant.id, active: true },
            overrideAccess: true,
          })
          return updated
        }
        return doc
      }

      return payload.create({
        collection: 'locations',
        data: { name, slug, tenant: tenant.id, active: true },
        overrideAccess: true,
      })
    }
    const locA = await findOrCreateLocation(`e2e-br-alpha${slugSuffix}`, `E2E Branch Alpha${slugSuffix}`)
    const locB = await findOrCreateLocation(`e2e-br-beta${slugSuffix}`, `E2E Branch Beta${slugSuffix}`)

    const classA = uniqueClassName('E2E Branch A timeslot marker')
    const classB = uniqueClassName('E2E Branch B timeslot marker')
    const etA = await createTestEventType(tenant.id, classA, 10, '', w)
    const etB = await createTestEventType(tenant.id, classB, 10, '', w)

    // Use today so the admin list's default date picker shows timeslots immediately.
    const startTime = new Date()
    startTime.setHours(14, 0, 0, 0)
    const endTime = new Date(startTime)
    endTime.setHours(15, 0, 0, 0)

    await createTestTimeslot(tenant.id, etA.id, startTime, endTime, undefined, true, locA.id as number)
    await createTestTimeslot(tenant.id, etB.id, startTime, endTime, undefined, true, locB.id as number)

    await loginAsTenantAdmin(page, 1, testData.users.tenantAdmin1.email, {
      request,
      tenantSlug: tenant.slug,
    })

    const adminOrigin = tenantAdminOrigin(tenant.slug)
    await page.goto(`${adminOrigin}/admin/collections/timeslots`, {
      waitUntil: 'domcontentloaded',
      timeout: process.env.CI ? 120_000 : 60_000,
    })

    await expect(page.getByRole('heading', { name: /timeslots/i }).first()).toBeVisible({
      timeout: process.env.CI ? 120_000 : 60_000,
    })

    // Branch selector API reads `payload-tenant`; set explicitly so options load before the client fetch.
    await page.context().addCookies([
      { name: 'payload-tenant', value: String(tenant.id), url: `${adminOrigin}/` },
      { name: 'payload-tenant', value: String(tenant.id), url: `${adminOrigin}/admin/` },
      { name: 'payload-tenant', value: String(tenant.id), url: `${adminOrigin}/admin/collections/` },
      // `AdminBranchSiteSelector` fetches `/api/admin/branch-selector-options`.
      { name: 'payload-tenant', value: String(tenant.id), url: `${adminOrigin}/api/admin/` },
    ])
    await page.reload({ waitUntil: 'domcontentloaded', timeout: process.env.CI ? 120_000 : 60_000 })
    await expect(page.getByRole('heading', { name: /timeslots/i }).first()).toBeVisible({
      timeout: process.env.CI ? 120_000 : 60_000,
    })

    const main = page.getByRole('main')

    // Filter to Branch Alpha by cookie + reload:
    await setPayloadLocationCookieAndReload(page, adminOrigin, locA.id as number)
    // Payload admin layout can move list content outside the `main` role; assert page-level.
    await expect(page.getByText(classA, { exact: false }).first()).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(classB, { exact: false })).toHaveCount(0)

    // Clear cookie to show all sites again:
    await setPayloadLocationCookieAndReload(page, adminOrigin, null)
    await expect(page.getByText(classA, { exact: false }).first()).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(classB, { exact: false }).first()).toBeVisible({ timeout: 30_000 })
  })
})
