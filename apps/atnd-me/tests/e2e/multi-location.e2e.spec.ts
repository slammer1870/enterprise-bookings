/**
 * Phase 7 Chunk 12 — Multi-branch public filter (branch-slug), location-manager admin scope, single-branch tenant.
 */
import type { Page } from '@playwright/test'
import { test, expect } from './helpers/fixtures'
import { navigateToTenant, getBranchSlugFromCookies } from './helpers/subdomain-helpers'
import { createTestEventType, createTestTimeslot, getPayloadInstance } from './helpers/data-helpers'
import { loginAsLocationManager, loginAsRegularUserViaApi } from './helpers/auth-helpers'
import { uniqueClassName } from '@repo/testing-config/src/playwright'

async function advanceScheduleToDate(page: Page, targetDate: Date) {
  // p.text-center.text-lg is rendered inside ScheduleLazy (ssr: false) — scope to page
  const dateLabel = page.locator('p.text-center.text-lg').first()
  await expect(dateLabel).toBeVisible({ timeout: 20000 })

  // The wrapper div contains: left-svg  p  right-svg (nth(1))
  const wrapper = dateLabel.locator('xpath=..')
  const rightArrow = wrapper.locator('svg').nth(1)
  await expect(rightArrow).toBeVisible({ timeout: 5000 })

  const targetLabel = targetDate.toDateString()
  for (let i = 0; i < 45; i += 1) {
    const currentLabel = (await dateLabel.textContent())?.trim()
    if (currentLabel === targetLabel) return

    await rightArrow.click({ force: true })
    await page.waitForTimeout(200)
  }

  await expect(dateLabel).toHaveText(targetLabel, { timeout: 15000 })
}

test.describe('Multi-location branches', () => {
  test.setTimeout(180_000)

  // Ensure fixture locations are active for this describe block and no stale extras.
  // Other test files (location-functionality-admin, admin-branch-selector) can leave
  // extra active locations on tenant1 that would change which branch the picker defaults to.
  test.beforeAll(async ({ testData }) => {
    const tenant = testData.tenants[0]
    const { north, south } = testData.tenant1Locations
    if (!tenant?.id || (!north?.id && !south?.id)) return
    const payload = await getPayloadInstance()
    const keepIds = [north?.id, south?.id].filter((id): id is number => id != null)
    // Deactivate any extra locations so only north + south are active.
    if (keepIds.length > 0) {
      await payload.update({
        collection: 'locations',
        where: {
          and: [
            { tenant: { equals: tenant.id } },
            { active: { equals: true } },
            { id: { not_in: keepIds } },
          ],
        },
        data: { active: false },
        overrideAccess: true,
      })
    }
    await Promise.all([
      north?.id
        ? payload.update({ collection: 'locations', id: north.id, data: { active: true }, overrideAccess: true })
        : Promise.resolve(),
      south?.id
        ? payload.update({ collection: 'locations', id: south.id, data: { active: true }, overrideAccess: true })
        : Promise.resolve(),
    ])
  })

  test.afterAll(async ({ testData }) => {
    const { north, south } = testData.tenant1Locations
    if (!north?.id && !south?.id) return
    const payload = await getPayloadInstance()
    await Promise.all([
      north?.id
        ? payload.update({ collection: 'locations', id: north.id, data: { active: false }, overrideAccess: true })
        : Promise.resolve(),
      south?.id
        ? payload.update({ collection: 'locations', id: south.id, data: { active: false }, overrideAccess: true })
        : Promise.resolve(),
    ])
  })

  test('public /home shows location picker defaulting to first branch; switching branch filters schedule', async ({
    page,
    testData,
  }) => {
    const tenant = testData.tenants[0]
    const { north, south } = testData.tenant1Locations
    const w = testData.workerIndex
    if (!tenant?.id || !tenant.slug || !north?.id || !north?.name || !south?.id || !south?.name) {
      throw new Error('Expected tenant1 and tenant1Locations fixtures')
    }

    const classNorth = uniqueClassName('E2E multi north slot')
    const classSouth = uniqueClassName('E2E multi south slot')
    const etNorth = await createTestEventType(tenant.id, classNorth, 10, '', w)
    const etSouth = await createTestEventType(tenant.id, classSouth, 10, '', w)

    const startTime = new Date()
    startTime.setDate(startTime.getDate() + 21)
    startTime.setHours(14, 0, 0, 0)
    const endTime = new Date(startTime)
    endTime.setHours(15, 0, 0, 0)

    await createTestTimeslot(tenant.id, etNorth.id, startTime, endTime, undefined, true, north.id)
    await createTestTimeslot(tenant.id, etSouth.id, startTime, endTime, undefined, true, south.id)

    await navigateToTenant(page, tenant.slug, '/home')
    await page.waitForURL((url) => url.pathname === '/' || url.pathname === '/home', {
      timeout: 15000,
    }).catch(() => null)
    await expect(page.getByText(/loading schedule/i)).not.toBeVisible({ timeout: 15000 }).catch(() => null)
    await expect(page.getByText('Show schedule for')).toBeVisible({ timeout: 20000 })

    await advanceScheduleToDate(page, startTime)
    await expect(page.getByText('No timeslots scheduled for today')).not.toBeVisible({ timeout: 5000 }).catch(() => null)

    // Picker defaults to the first branch alphabetically (north sorts before south).
    // North timeslot visible; south timeslot filtered out.
    await expect(page.getByText(classNorth).first()).toBeVisible({ timeout: 20000 })
    await expect(page.getByText(classSouth)).toHaveCount(0, { timeout: 5000 })

    // Switch to south via the picker.
    // The header is `position: absolute` and can intercept clicks; use a DOM click to open.
    const locationPicker = page.getByText('Show schedule for').locator('xpath=..')
    const branchCombobox = locationPicker.getByRole('combobox')
    await locationPicker.scrollIntoViewIfNeeded()
    await branchCombobox.evaluate((el) => (el as HTMLButtonElement).click())
    await page.getByRole('option', { name: south.name }).click()

    await expect(page.getByText(/loading schedule/i)).not.toBeVisible({ timeout: 15000 }).catch(() => null)
    await advanceScheduleToDate(page, startTime)

    await expect(page.getByText(classSouth).first()).toBeVisible({ timeout: 20000 })
    await expect(page.getByText(classNorth)).toHaveCount(0, { timeout: 5000 })
  })

  test('location manager sees only timeslots for assigned branch in admin list', async ({
    page,
    request,
    testData,
  }) => {
    const tenant = testData.tenants[0]
    const { north, south } = testData.tenant1Locations
    const lm = testData.users.locationManager1
    const w = testData.workerIndex
    if (!tenant?.slug || !lm?.email) throw new Error('Expected tenant1 and locationManager1 fixtures')

    const classNorth = uniqueClassName('E2E LM north marker')
    const classSouth = uniqueClassName('E2E LM south marker')
    const etNorth = await createTestEventType(tenant.id, classNorth, 10, '', w)
    const etSouth = await createTestEventType(tenant.id, classSouth, 10, '', w)

    // Use today so the admin list's default date picker (today) shows the timeslots immediately.
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

    const adminOrigin = `http://${tenant.slug}.localhost:3000`
    await page.goto(`${adminOrigin}/admin/collections/timeslots`, {
      waitUntil: 'domcontentloaded',
      timeout: process.env.CI ? 120_000 : 60_000,
    })

    await expect(page.getByRole('heading', { name: /timeslots/i }).first()).toBeVisible({
      timeout: process.env.CI ? 120_000 : 60_000,
    })

    // Don't scope to `main` — Payload admin layout changes the `main` subtree
    // while list content still renders. Assert against the page-level text nodes.
    const northMarker = page.getByText(classNorth, { exact: false }).first()
    await expect(northMarker).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(classSouth, { exact: false })).toHaveCount(0)
  })

  test('single-branch tenant: customer on /home sees seeded slot without /locations route', async ({
    page,
    testData,
  }) => {
    const tenant3 = testData.tenants[2]
    const loc = testData.tenant3Location
    const user = testData.users.userSingleBranch
    const w = testData.workerIndex
    if (!tenant3?.id || !tenant3.slug || !user?.email) {
      throw new Error('Expected tenant3 and userSingleBranch fixtures')
    }

    const classOnly = uniqueClassName('E2E single-branch slot')
    const et = await createTestEventType(tenant3.id, classOnly, 10, '', w)

    const startTime = new Date()
    startTime.setDate(startTime.getDate() + 23)
    startTime.setHours(16, 0, 0, 0)
    const endTime = new Date(startTime)
    endTime.setHours(17, 0, 0, 0)

    await createTestTimeslot(tenant3.id, et.id, startTime, endTime, undefined, true, loc.id)

    await loginAsRegularUserViaApi(page, user.email, 'password', { tenantSlug: tenant3.slug })

    await navigateToTenant(page, tenant3.slug, '/home')
    await page.waitForURL((url) => url.pathname === '/' || url.pathname === '/home', {
      timeout: 15000,
    }).catch(() => null)
    await expect(page.getByText(/loading schedule/i)).not.toBeVisible({ timeout: 15000 }).catch(() => null)

    await advanceScheduleToDate(page, startTime)
    await expect(page.getByText('No timeslots scheduled for today')).not.toBeVisible({ timeout: 5000 }).catch(() => null)
    await expect(page.getByText(classOnly).first()).toBeVisible({ timeout: 20000 })
  })
})
