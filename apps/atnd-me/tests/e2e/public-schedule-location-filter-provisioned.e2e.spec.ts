/**
 * Public-facing schedule filtering by location (Phase 7 Chunk 12).
 *
 * Provisions tenants with Hero+Schedule blocks configured for one or more branches.
 */
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

  test('hero schedule block shows only the configured branch', async ({ page, testData }) => {
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
            location: [northId],
          },
        ],
      },
      draft: false,
      overrideAccess: true,
    })

    const expectLoadingGone = async () => {
      await expect(page.getByText(/loading schedule/i)).not.toBeVisible({ timeout: 15000 }).catch(() => null)
    }

    // Hero schedule is locked to north — only north timeslots appear; no branch picker.
    await navigateToTenant(page, tenantSlug, `/${pageSlug}`)
    await expectLoadingGone()
    await expect(page.getByText('Show schedule for')).toHaveCount(0)
    await expect(page.getByText(classNorth, { exact: false }).first()).toBeVisible({ timeout: 20000 })
    await expect(page.getByText(classSouth, { exact: false })).toHaveCount(0, { timeout: 20000 })

    // Visiting another branch route does not change the locked hero schedule.
    await navigateToTenant(page, tenantSlug, `/locations/${south.slug}`)
    await expect(await getBranchSlugFromCookies(page)).toBe(south.slug)
    await navigateToTenant(page, tenantSlug, `/${pageSlug}`)
    await expectLoadingGone()
    await expect(page.getByText(classNorth, { exact: false }).first()).toBeVisible({ timeout: 20000 })
    await expect(page.getByText(classSouth, { exact: false })).toHaveCount(0, { timeout: 20000 })

    // Cleanup
    await payload.delete({
      collection: 'tenants',
      where: { id: { equals: tenantId } },
      overrideAccess: true,
    })
  })

  test('hero schedule block with two configured branches shows a location picker', async ({
    page,
    testData,
  }) => {
    const payload = await getPayloadInstance()

    const tenantName = `E2E Filter Toggle Tenant ${testData.workerIndex}`
    const tenantSlug = `e2e-filter-toggle-${testData.workerIndex}-${Date.now()}`

    const tenant = (await createTestTenant(tenantName, tenantSlug)) as Tenant
    const tenantId = Number((tenant as any).id)

    const baseDateTime = new Date()
    baseDateTime.setSeconds(0, 0)
    baseDateTime.setHours(14, 0, 0, 0)
    const endTime = new Date(baseDateTime)
    endTime.setHours(baseDateTime.getHours() + 1)

    const north = await payload.create({
      collection: 'locations',
      data: {
        name: 'E2E Toggle North',
        slug: `e2e-toggle-north-${testData.workerIndex}-${Date.now()}`,
        tenant: tenantId,
        active: true,
      },
      overrideAccess: true,
    })
    const south = await payload.create({
      collection: 'locations',
      data: {
        name: 'E2E Toggle South',
        slug: `e2e-toggle-south-${testData.workerIndex}-${Date.now()}`,
        tenant: tenantId,
        active: true,
      },
      overrideAccess: true,
    })

    const northId = north.id as number
    const southId = south.id as number

    const classNorth = uniqueClassName('E2E toggle north')
    const classSouth = uniqueClassName('E2E toggle south')

    const etNorth = await createTestEventType(tenantId, classNorth, 10, '', testData.workerIndex)
    const etSouth = await createTestEventType(tenantId, classSouth, 10, '', testData.workerIndex)

    await createTestTimeslot(tenantId, etNorth.id, baseDateTime, endTime, undefined, true, northId)
    await createTestTimeslot(tenantId, etSouth.id, baseDateTime, endTime, undefined, true, southId)

    const pageSlug = `e2e-toggle-schedule-${testData.workerIndex}-${Date.now()}`
    await payload.create({
      collection: 'pages',
      data: {
        slug: pageSlug,
        title: 'E2E Toggle Schedule Page',
        tenant: tenantId,
        _status: 'published',
        layout: [
          {
            blockType: 'heroScheduleSanctuary',
            blockName: 'E2E Hero Schedule Toggle',
            location: [northId, southId],
          },
        ],
      },
      draft: false,
      overrideAccess: true,
    })

    const expectLoadingGone = async () => {
      await expect(page.getByText(/loading schedule/i)).not.toBeVisible({ timeout: 15000 }).catch(() => null)
    }

    await navigateToTenant(page, tenantSlug, `/${pageSlug}`)
    await expectLoadingGone()
    await expect(page.getByText('Show schedule for')).toBeVisible({ timeout: 20000 })
    await expect(page.getByText(classNorth, { exact: false }).first()).toBeVisible({ timeout: 20000 })
    await expect(page.getByText(classSouth, { exact: false })).toHaveCount(0, { timeout: 20000 })

    await page.getByRole('combobox').click()
    await page.getByRole('option', { name: 'E2E Toggle South' }).click()
    await expectLoadingGone()
    await expect(page.getByText(classSouth, { exact: false }).first()).toBeVisible({ timeout: 20000 })
    await expect(page.getByText(classNorth, { exact: false })).toHaveCount(0, { timeout: 20000 })

    await payload.delete({
      collection: 'tenants',
      where: { id: { equals: tenantId } },
      overrideAccess: true,
    })
  })
})

