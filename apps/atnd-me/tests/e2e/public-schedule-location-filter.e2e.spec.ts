/**
 * Public schedule location picker filtering (Phase 7 Chunk 12).
 *
 * Uses the standalone Schedule block (not Hero+Schedule) so visitors can switch
 * branches via the dropdown on multi-location tenants.
 */
import type { Page } from '@playwright/test'
import { test, expect } from './helpers/fixtures'
import { navigateToTenant } from './helpers/subdomain-helpers'
import { createTestEventType, createTestTimeslot, getPayloadInstance } from './helpers/data-helpers'
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

test.describe('Public schedule location picker', () => {
  test.setTimeout(180_000)

  test.beforeAll(async ({ testData }) => {
    const { north, south } = testData.tenant1Locations
    if (!north?.id && !south?.id) return
    const payload = await getPayloadInstance()
    await Promise.all([
      north?.id
        ? payload.update({
            collection: 'locations',
            id: north.id,
            data: { active: true },
            overrideAccess: true,
          })
        : Promise.resolve(),
      south?.id
        ? payload.update({
            collection: 'locations',
            id: south.id,
            data: { active: true },
            overrideAccess: true,
          })
        : Promise.resolve(),
    ])
  })

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

  test('multi-location tenant: selecting a location filters the schedule', async ({ page, testData }) => {
    const tenant = testData.tenants[0]
    const { north, south } = testData.tenant1Locations
    const w = testData.workerIndex
    if (!tenant?.id || !tenant?.slug || !north?.id || !north?.name || !north?.slug || !south?.id || !south?.name) {
      throw new Error('Expected tenant1 and tenant1Locations fixtures')
    }

    const payload = await getPayloadInstance()
    const pageSlug = `e2e-schedule-picker-${w}-${Date.now()}`

    await payload.create({
      collection: 'pages',
      data: {
        slug: pageSlug,
        title: 'E2E Schedule Picker Page',
        tenant: tenant.id,
        _status: 'published',
        layout: [{ blockType: 'schedule', blockName: 'Schedule' }],
      },
      draft: false,
      overrideAccess: true,
    })

    const classNorth = uniqueClassName('E2E Public schedule north slot')
    const classSouth = uniqueClassName('E2E Public schedule south slot')

    const etNorth = await createTestEventType(tenant.id, classNorth, 10, '', w)
    const etSouth = await createTestEventType(tenant.id, classSouth, 10, '', w)

    const startTime = new Date()
    startTime.setDate(startTime.getDate() + 21)
    startTime.setHours(14, 0, 0, 0)
    const endTime = new Date(startTime)
    endTime.setHours(15, 0, 0, 0)

    await createTestTimeslot(tenant.id, etNorth.id, startTime, endTime, undefined, true, north.id)
    await createTestTimeslot(tenant.id, etSouth.id, startTime, endTime, undefined, true, south.id)

    await navigateToTenant(page, tenant.slug, `/${pageSlug}`)

    // Wait for schedule to be present and move to the target date.
    await page
      .waitForURL((url) => url.pathname === `/${pageSlug}`, { timeout: 15000 })
      .catch(() => null)
    await expect(page.getByText(/loading schedule/i)).not.toBeVisible({ timeout: 15000 }).catch(() => null)
    await expect(page.getByText('Show schedule for')).toBeVisible({ timeout: 20000 })

    await advanceScheduleToDate(page, startTime)

    // Default view uses the first/default branch — north appears, south does not.
    await expect(page.getByText(classNorth).first()).toBeVisible({ timeout: 20000 })
    await expect(page.getByText(classSouth)).toHaveCount(0, { timeout: 20000 })

    // Switch branch via the public location picker dropdown.
    // The tenant header is `position: absolute` and can intercept Playwright clicks at the top of the page.
    const locationPicker = page.getByText('Show schedule for').locator('xpath=..')
    const branchCombobox = locationPicker.getByRole('combobox')
    await locationPicker.scrollIntoViewIfNeeded()
    await branchCombobox.evaluate((el) => (el as HTMLButtonElement).click())
    await page.getByRole('option', { name: south.name }).click()

    await expect(page.getByText(/loading schedule/i)).not.toBeVisible({ timeout: 15000 }).catch(() => null)
    await advanceScheduleToDate(page, startTime)

    await expect(page.getByText(classNorth)).toHaveCount(0, { timeout: 20000 })
    await expect(page.getByText(classSouth).first()).toBeVisible({ timeout: 20000 })

    await payload.delete({
      collection: 'pages',
      where: { slug: { equals: pageSlug }, tenant: { equals: tenant.id } },
      overrideAccess: true,
    })
  })
})

