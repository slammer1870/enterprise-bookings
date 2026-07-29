/**
 * Courses listing + detail: open published courses appear on /courses; detail shows
 * window copy and sticky enroll panel.
 */
import { test, expect } from './helpers/fixtures'
import { navigateToTenant } from './helpers/subdomain-helpers'
import { createTestEventType, getPayloadInstance } from './helpers/data-helpers'

test.describe('Courses listing', () => {
  test.describe.configure({ timeout: 60_000 })

  test('/courses lists open course and detail shows enroll panel', async ({ page, testData }) => {
    const payload = await getPayloadInstance()
    const tenantId = testData.tenants[0]?.id
    const tenantSlug = testData.tenants[0]?.slug
    const w = testData.workerIndex
    if (!tenantId || !tenantSlug) throw new Error('Tenant required')

    const eventType = await createTestEventType(tenantId, 'Course Listing Class', 8, undefined, w)
    const slug = `e2e-course-list-${w}-${Date.now()}`
    const title = `E2E Open Course w${w} ${Date.now()}`

    await payload.create({
      collection: 'courses',
      data: {
        title,
        slug,
        durationLength: 6,
        durationUnit: 'weeks',
        allowedEventTypes: [eventType.id],
        status: 'open',
        tenant: tenantId,
        priceInformation: { price: 75 },
        about: 'Learn the fundamentals in six weeks.',
      },
      overrideAccess: true,
      context: { skipStripeSync: true },
    })

    await navigateToTenant(page, tenantSlug, '/courses')
    await page.waitForLoadState('domcontentloaded').catch(() => null)

    await expect(page.getByRole('heading', { name: /^courses$/i })).toBeVisible({ timeout: 15000 })
    const list = page.getByTestId('courses-list')
    await expect(list).toBeVisible({ timeout: 15000 })
    await expect(page.getByTestId('course-list-item').filter({ hasText: title })).toBeVisible()

    await page.getByTestId('course-list-item').filter({ hasText: title }).click()
    await expect(page).toHaveURL(new RegExp(`/courses/${slug}`))
    await expect(page.getByRole('heading', { name: title })).toBeVisible({ timeout: 15000 })
    await expect(page.getByTestId('course-enroll-panel')).toBeVisible()
    await expect(page.getByText(/6 weeks from purchase|enroll/i).first()).toBeVisible()
  })
})
