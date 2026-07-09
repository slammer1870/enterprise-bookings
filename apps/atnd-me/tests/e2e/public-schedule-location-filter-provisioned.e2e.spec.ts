/**
 * Public-facing schedule filtering by location (Phase 7 Chunk 12).
 *
 * This test provisions its own tenant/locations/timeslots (via Payload API),
 * creates a page with the Hero+Schedule block, then verifies that switching
 * public location routes updates the schedule timeslots accordingly.
 */
import type { Page } from '@playwright/test'
import { test, expect } from './helpers/fixtures'
import { navigateToTenant, getBranchSlugFromCookies } from './helpers/subdomain-helpers'
import {
  createTestTenant,
  createTestEventType,
  createTestTimeslot,
  getPayloadInstance,
} from './helpers/data-helpers'
import { uniqueClassName } from '@repo/testing-config/src/playwright'
import type { Tenant } from '@repo/shared-types'

test.describe('Public schedule filtering by location (provisioned)', () => {
  test.setTimeout(180_000)

  test('switching locations filters today timeslots', async ({ page, testData }) => {
    const payload = await getPayloadInstance()

    const tenantName = `E2E Filter Tenant ${testData.workerIndex}`
    const tenantSlug = `e2e-filter-tenant-${testData.workerIndex}-${Date.now()}`

    const tenant = (await createTestTenant(tenantName, tenantSlug)) as Tenant
    const tenantId = Number((tenant as any).id)

    const baseDateTime = new Date()
    baseDateTime.setSeconds(0, 0)
    // Use a stable daytime hour to reduce any edge cases around midnight/timezones.
    baseDateTime.setHours(14, 0, 0, 0)
    const endTime = new Date(baseDateTime)
    endTime.setHours(baseDateTime.getHours() + 1)

    const north = await payload.create({
      collection: 'locations',
      data: {
        name: 'E2E North Branch',
        slug: `e2e-north-${testData.workerIndex}-${Date.now()}`,
        tenant: tenantId,
        active: true,
      },
      overrideAccess: true,
    })
    const south = await payload.create({
      collection: 'locations',
      data: {
        name: 'E2E South Branch',
        slug: `e2e-south-${testData.workerIndex}-${Date.now()}`,
        tenant: tenantId,
        active: true,
      },
      overrideAccess: true,
    })

    const northId = north.id as number
    const southId = south.id as number

    const classNorth = uniqueClassName('E2E provisioned north')
    const classSouth = uniqueClassName('E2E provisioned south')

    const etNorth = await createTestEventType(tenantId, classNorth, 10, '', testData.workerIndex)
    const etSouth = await createTestEventType(tenantId, classSouth, 10, '', testData.workerIndex)

    await createTestTimeslot(tenantId, etNorth.id, baseDateTime, endTime, undefined, true, northId)
    await createTestTimeslot(tenantId, etSouth.id, baseDateTime, endTime, undefined, true, southId)

    // Create a public page that includes the Hero+Schedule block.
    const pageSlug = `e2e-provisioned-schedule-${testData.workerIndex}-${Date.now()}`
    await payload.create({
      collection: 'pages',
      data: {
        slug: pageSlug,
        title: 'E2E Provisioned Schedule Page',
        tenant: tenantId,
        _status: 'published',
        layout: [
          {
            blockType: 'heroScheduleSanctuary',
            blockName: 'E2E Hero Schedule',
          },
        ],
      },
      draft: false,
      overrideAccess: true,
    })

    const originTenant = `http://${tenantSlug}.localhost:3000`

    const expectLoadingGone = async () => {
      await expect(page.getByText(/loading schedule/i)).not.toBeVisible({ timeout: 15000 }).catch(() => null)
    }

    // 1) Open the page with no branch cookie → should show both branches.
    await navigateToTenant(page, tenantSlug, `/${pageSlug}`)
    await expectLoadingGone()
    await expect(page.getByText(classNorth, { exact: false }).first()).toBeVisible({ timeout: 20000 })
    await expect(page.getByText(classSouth, { exact: false }).first()).toBeVisible({ timeout: 20000 })

    // 2) Switch to north public route → cookie should update.
    await navigateToTenant(page, tenantSlug, `/locations/${north.slug}`)
    await expect(await getBranchSlugFromCookies(page)).toBe(north.slug)
    await navigateToTenant(page, tenantSlug, `/${pageSlug}`)
    await expectLoadingGone()
    await expect(page.getByText(classNorth, { exact: false }).first()).toBeVisible({ timeout: 20000 })
    await expect(page.getByText(classSouth, { exact: false })).toHaveCount(0, { timeout: 20000 })

    // 3) Switch to south public route → schedule should show only south.
    await navigateToTenant(page, tenantSlug, `/locations/${south.slug}`)
    await expect(await getBranchSlugFromCookies(page)).toBe(south.slug)
    await navigateToTenant(page, tenantSlug, `/${pageSlug}`)
    await expectLoadingGone()
    await expect(page.getByText(classSouth, { exact: false }).first()).toBeVisible({ timeout: 20000 })
    await expect(page.getByText(classNorth, { exact: false })).toHaveCount(0, { timeout: 20000 })

    // Cleanup
    await payload.delete({
      collection: 'tenants',
      where: { id: { equals: tenantId } },
      overrideAccess: true,
    })
  })
})

