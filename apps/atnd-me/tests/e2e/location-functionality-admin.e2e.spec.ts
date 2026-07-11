import { test, expect } from './helpers/fixtures'
import {
  copySessionCookiesToTenantDomain,
  loginAsLocationManager,
  loginAsSuperAdmin,
  loginAsTenantAdmin,
} from './helpers/auth-helpers'
import { createTestEventType, createTestTimeslot, getPayloadInstance } from './helpers/data-helpers'
import { ensureSidebarOpen } from './helpers/admin-tenant-selector-helpers'
import { uniqueClassName } from '@repo/testing-config/src/playwright'

function tenantAdminOrigin(slug: string): string {
  return `http://${slug}.localhost:3000`
}

async function setPayloadLocationCookieAndReload(page: Parameters<typeof test>[0]['page'], adminOrigin: string, locationId: number | null) {
  const value = locationId == null ? '' : String(locationId)
  // `timeslotsRead` parses `payload-location` as a positive int; empty string becomes `null`.
  // Use URL-scoped cookies to keep behaviour aligned with passing e2e specs.
  const { hostname } = new URL(adminOrigin)
  // Middleware clears `payload-location` if `tenant-slug` doesn't match the resolved subdomain.
  const tenantSlug = hostname.split('.')[0] || ''

  await page.context().addCookies([
    // Keep sidebar tenant context stable during reloads.
    { name: 'tenant-slug', value: tenantSlug, url: `${adminOrigin}/` },
    { name: 'tenant-slug', value: tenantSlug, url: `${adminOrigin}/admin/` },
    { name: 'payload-location', value, url: `${adminOrigin}/` },
    { name: 'payload-location', value, url: `${adminOrigin}/admin/` },
    { name: 'payload-location', value, url: `${adminOrigin}/admin/collections/` },
    // Payload admin API requests often hit paths under `/admin/api/...`,
    // so include those too (cookie path must match).
    { name: 'payload-location', value, url: `${adminOrigin}/admin/api/` },
    { name: 'payload-location', value, url: `${adminOrigin}/admin/api/collections/` },
  ])

  await page.reload({ waitUntil: 'domcontentloaded', timeout: process.env.CI ? 120_000 : 60_000 })

  // Sanity-check: Playwright should actually have this cookie after reload.
  const seenPayloadLocation = await page.evaluate(() => {
    return document.cookie
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith('payload-location='))
      ?.split('=')[1]
  })
  expect(seenPayloadLocation).toBe(value)
}

test.describe('Location functionality (admin)', () => {
  test.setTimeout(180_000)

  // Deactivate fixture locations after all tests in this describe block.
  // The tests set tenant1Locations (north/south) to active=true; without cleanup the active
  // state contaminates later tests (e.g. timeslot creation fails branch-required validation).
  test.afterAll(async ({ testData }) => {
    const { north, south } = testData.tenant1Locations
    if (!north?.id && !south?.id) return
    const payload = await getPayloadInstance()
    await Promise.all([
      north?.id
        ? payload.update({
            collection: 'locations',
            id: north.id,
            data: { active: false },
            overrideAccess: true,
          })
        : Promise.resolve(),
      south?.id
        ? payload.update({
            collection: 'locations',
            id: south.id,
            data: { active: false },
            overrideAccess: true,
          })
        : Promise.resolve(),
    ])
  })

  test('tenant admin: location selector renders below tenant selector', async ({
    page,
    request,
    testData,
  }) => {
    const tenant = testData.tenants[0]
    if (!tenant?.id || !tenant.slug) throw new Error('Expected tenant fixture')
    const { north, south } = testData.tenant1Locations
    if (!north?.id || !south?.id) throw new Error('Expected tenant locations fixture')

    const payload = await getPayloadInstance()
    // Ensure we have at least two active locations for the selected tenant.
    await Promise.all([
      payload.update({
        collection: 'locations',
        id: north.id,
        data: { active: true },
        overrideAccess: true,
      }),
      payload.update({
        collection: 'locations',
        id: south.id,
        data: { active: true },
        overrideAccess: true,
      }),
    ])

    const activeLocations = await payload.find({
      collection: 'locations',
      where: { tenant: { equals: tenant.id }, active: { equals: true } },
      limit: 10,
      overrideAccess: true,
    })
    expect(activeLocations.docs.length).toBeGreaterThan(1)

    await loginAsSuperAdmin(page, testData.users.superAdmin.email, { request })

    const adminOrigin = tenantAdminOrigin(tenant.slug)
    // Super admin login happens on the base domain; copy session cookies so the tenant subdomain renders admin UI.
    const cookies = await page.context().cookies()
    const tenantSessionCookies = copySessionCookiesToTenantDomain(cookies, tenant.slug)
    if (tenantSessionCookies.length) {
      await page.context().addCookies(tenantSessionCookies)
    }
    await page.goto(`${adminOrigin}/admin/collections/timeslots`, {
      waitUntil: 'domcontentloaded',
      timeout: process.env.CI ? 120_000 : 60_000,
    })
    await page.context().addCookies([
      // Branch selector API reads `payload-tenant`; set explicitly for consistent browser behavior.
      { name: 'payload-tenant', value: String(tenant.id), url: `${adminOrigin}/` },
      { name: 'payload-tenant', value: String(tenant.id), url: `${adminOrigin}/admin/` },
      { name: 'payload-tenant', value: String(tenant.id), url: `${adminOrigin}/admin/collections/` },
      // `AdminBranchSiteSelector` fetches `/api/admin/branch-selector-options`.
      { name: 'payload-tenant', value: String(tenant.id), url: `${adminOrigin}/api/admin/` },
      { name: 'tenant-slug', value: tenant.slug, url: `${adminOrigin}/` },
    ])
    await page.reload({ waitUntil: 'domcontentloaded', timeout: process.env.CI ? 120_000 : 60_000 })

    const tenantSelector = page.getByTestId('tenant-selector')
    const locationSelector = page.getByTestId('branch-site-selector')

    await expect(tenantSelector).toBeVisible({ timeout: 30_000 })
    await expect(locationSelector).toBeVisible({ timeout: 30_000 })

    const tenantBox = await tenantSelector.boundingBox()
    const locationBox = await locationSelector.boundingBox()
    expect(tenantBox).not.toBeNull()
    expect(locationBox).not.toBeNull()
    expect(locationBox!.y).toBeGreaterThan(tenantBox!.y)
  })

  test('tenant admin: changing payload-location filters timeslots list', async ({ page, request, testData }) => {
    const tenant = testData.tenants[0]
    if (!tenant?.id || !tenant.slug) throw new Error('Expected tenant fixture')

    const { north, south } = testData.tenant1Locations
    if (!north?.id || !south?.id) throw new Error('Expected tenant locations fixture')

    const payload = await getPayloadInstance()
    // Ensure both locations are active so the branch selector endpoint returns them.
    await Promise.all([
      payload.update({
        collection: 'locations',
        id: north.id,
        data: { active: true },
        overrideAccess: true,
      }),
      payload.update({
        collection: 'locations',
        id: south.id,
        data: { active: true },
        overrideAccess: true,
      }),
    ])

    const classNorth = uniqueClassName('E2E loc filtering north marker')
    const classSouth = uniqueClassName('E2E loc filtering south marker')
    const etNorth = await createTestEventType(tenant.id, classNorth, 10, '', testData.workerIndex)
    const etSouth = await createTestEventType(tenant.id, classSouth, 10, '', testData.workerIndex)

    const startTime = new Date()
    startTime.setHours(14, 0, 0, 0)
    const endTime = new Date(startTime)
    endTime.setHours(15, 0, 0, 0)

    await createTestTimeslot(tenant.id, etNorth.id, startTime, endTime, undefined, true, north.id)
    await createTestTimeslot(tenant.id, etSouth.id, startTime, endTime, undefined, true, south.id)

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

    // Branch selector API reads `payload-tenant`; set explicitly so options load before fetch.
    await page.context().addCookies([
      { name: 'payload-tenant', value: String(tenant.id), url: `${adminOrigin}/` },
      { name: 'payload-tenant', value: String(tenant.id), url: `${adminOrigin}/admin/` },
      { name: 'payload-tenant', value: String(tenant.id), url: `${adminOrigin}/admin/collections/` },
      { name: 'payload-tenant', value: String(tenant.id), url: `${adminOrigin}/api/admin/` },
    ])
    await page.reload({ waitUntil: 'domcontentloaded', timeout: process.env.CI ? 120_000 : 60_000 })

    // Clear cookie first: both branches should be visible.
    await setPayloadLocationCookieAndReload(page, adminOrigin, null)
    await expect(page.getByText(classNorth, { exact: false }).first()).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(classSouth, { exact: false }).first()).toBeVisible({ timeout: 30_000 })

    // Filter to North.
    await setPayloadLocationCookieAndReload(page, adminOrigin, north.id)
    await expect(page.getByText(classNorth, { exact: false }).first()).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(classSouth, { exact: false }).first()).toBeHidden({ timeout: 30_000 })

    // Clear cookie again: both should return.
    await setPayloadLocationCookieAndReload(page, adminOrigin, null)
    await expect(page.getByText(classNorth, { exact: false }).first()).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(classSouth, { exact: false }).first()).toBeVisible({ timeout: 30_000 })
  })

  test('tenant admin: payload-location hides timeslots with no branch set', async ({ page, request, testData }) => {
    const tenant = testData.tenants[0]
    if (!tenant?.id || !tenant.slug) throw new Error('Expected tenant fixture')

    const { north, south } = testData.tenant1Locations
    if (!north?.id || !south?.id) throw new Error('Expected tenant locations fixture')

    const payload = await getPayloadInstance()
    // Ensure both locations are active so the branch selector endpoint returns them.
    await Promise.all([
      payload.update({
        collection: 'locations',
        id: north.id,
        data: { active: true },
        overrideAccess: true,
      }),
      payload.update({
        collection: 'locations',
        id: south.id,
        data: { active: true },
        overrideAccess: true,
      }),
    ])

    const classNorth = uniqueClassName('E2E loc filtering branch-north marker')
    const classSouth = uniqueClassName('E2E loc filtering branch-south marker')
    const classNoBranch = uniqueClassName('E2E loc filtering no-branch marker')

    const etNorth = await createTestEventType(tenant.id, classNorth, 10, '', testData.workerIndex)
    const etSouth = await createTestEventType(tenant.id, classSouth, 10, '', testData.workerIndex)
    const etNoBranch = await createTestEventType(tenant.id, classNoBranch, 10, '', testData.workerIndex)

    const startTime = new Date()
    startTime.setHours(14, 0, 0, 0)
    const endTime = new Date(startTime)
    endTime.setHours(15, 0, 0, 0)

    await createTestTimeslot(tenant.id, etNorth.id, startTime, endTime, undefined, true, north.id)
    await createTestTimeslot(tenant.id, etSouth.id, startTime, endTime, undefined, true, south.id)
    // No branch/location set on the timeslot itself (`null` skips default-branch resolution).
    await createTestTimeslot(tenant.id, etNoBranch.id, startTime, endTime, undefined, true, null)

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

    // Branch selector API reads `payload-tenant`; set explicitly so options load before fetch.
    await page.context().addCookies([
      { name: 'payload-tenant', value: String(tenant.id), url: `${adminOrigin}/` },
      { name: 'payload-tenant', value: String(tenant.id), url: `${adminOrigin}/admin/` },
      { name: 'payload-tenant', value: String(tenant.id), url: `${adminOrigin}/admin/collections/` },
      { name: 'payload-tenant', value: String(tenant.id), url: `${adminOrigin}/api/admin/` },
    ])
    await page.reload({ waitUntil: 'domcontentloaded', timeout: process.env.CI ? 120_000 : 60_000 })

    // Clear cookie first: all three should be visible.
    await setPayloadLocationCookieAndReload(page, adminOrigin, null)
    await expect(page.getByText(classNorth, { exact: false }).first()).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(classSouth, { exact: false }).first()).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(classNoBranch, { exact: false }).first()).toBeVisible({ timeout: 30_000 })

    // Filter to North: South + no-branch should disappear.
    await setPayloadLocationCookieAndReload(page, adminOrigin, north.id)
    await expect(page.getByText(classNorth, { exact: false }).first()).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(classSouth, { exact: false }).first()).toBeHidden({ timeout: 60_000 })
    await expect(page.getByText(classNoBranch, { exact: false }).first()).toBeHidden({ timeout: 60_000 })

    // Clear again: all three should return (prevents any admin list caching edge).
    await setPayloadLocationCookieAndReload(page, adminOrigin, null)
    await expect(page.getByText(classNorth, { exact: false }).first()).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(classSouth, { exact: false }).first()).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(classNoBranch, { exact: false }).first()).toBeVisible({ timeout: 30_000 })

    // Filter to South: North + no-branch should disappear.
    await setPayloadLocationCookieAndReload(page, adminOrigin, south.id)
    await expect(page.getByText(classSouth, { exact: false }).first()).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(classNorth, { exact: false }).first()).toBeHidden({ timeout: 30_000 })
    await expect(page.getByText(classNoBranch, { exact: false }).first()).toBeHidden({ timeout: 30_000 })

    // Clear again: all three should return.
    await setPayloadLocationCookieAndReload(page, adminOrigin, null)
    await expect(page.getByText(classNorth, { exact: false }).first()).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(classSouth, { exact: false }).first()).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(classNoBranch, { exact: false }).first()).toBeVisible({ timeout: 30_000 })
  })

  test('location-manager: sees only assigned branch in admin list', async ({ page, request, testData }) => {
    const tenant = testData.tenants[0]
    if (!tenant?.id || !tenant.slug) throw new Error('Expected tenant fixture')

    const { north, south } = testData.tenant1Locations
    const lm = testData.users.locationManager1
    const w = testData.workerIndex
    if (!lm?.email) throw new Error('Expected location-manager fixture')

    // location-manager fixture is assigned to north via setupE2ETestData.
    const classNorth = uniqueClassName('E2E locmgr north marker')
    const classSouth = uniqueClassName('E2E locmgr south marker')

    const etNorth = await createTestEventType(tenant.id, classNorth, 10, '', w)
    const etSouth = await createTestEventType(tenant.id, classSouth, 10, '', w)

    const startTime = new Date()
    startTime.setHours(10, 0, 0, 0)
    const endTime = new Date(startTime)
    endTime.setHours(11, 0, 0, 0)

    await createTestTimeslot(tenant.id, etNorth.id, startTime, endTime, undefined, true, north.id)
    await createTestTimeslot(tenant.id, etSouth.id, startTime, endTime, undefined, true, south.id)

    await loginAsLocationManager(page, lm.email, {
      request,
      tenantSlug: tenant.slug,
      password: 'password',
    })

    const adminOrigin = tenantAdminOrigin(tenant.slug)
    await page.goto(`${adminOrigin}/admin/collections/timeslots`, {
      waitUntil: 'domcontentloaded',
      timeout: process.env.CI ? 120_000 : 60_000,
    })
    await expect(page.getByRole('heading', { name: /timeslots/i }).first()).toBeVisible({
      timeout: process.env.CI ? 120_000 : 60_000,
    })

    // Don't scope to `main` — Payload admin layout can move list content outside the `main` subtree.
    const northMarker = page.getByText(classNorth, { exact: false }).first()
    await expect(northMarker).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(classSouth, { exact: false })).toHaveCount(0)
  })
})

