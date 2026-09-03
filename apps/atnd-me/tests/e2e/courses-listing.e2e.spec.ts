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
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

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
        startDate: tomorrow.toISOString().slice(0, 10),
        maxEnrollments: 9,
        priceInformation: { price: 75 },
        about: {
          root: {
            type: 'root',
            format: '',
            indent: 0,
            version: 1,
            direction: 'ltr',
            children: [
              {
                type: 'paragraph',
                format: '',
                indent: 0,
                version: 1,
                direction: 'ltr',
                children: [
                  {
                    type: 'text',
                    detail: 0,
                    format: 0,
                    mode: 'normal',
                    style: '',
                    text: 'Learn the fundamentals in six weeks.',
                    version: 1,
                  },
                ],
              },
            ],
          },
        },
      },
      overrideAccess: true,
      context: { skipStripeSync: true },
    })

    await payload.create({
      collection: 'courses',
      data: {
        title: `E2E Past Course w${w} ${Date.now()}`,
        slug: `e2e-course-past-${w}-${Date.now()}`,
        durationLength: 6,
        durationUnit: 'weeks',
        allowedEventTypes: [eventType.id],
        status: 'open',
        tenant: tenantId,
        startDate: yesterday.toISOString().slice(0, 10),
        priceInformation: { price: 75 },
      },
      overrideAccess: true,
      context: { skipStripeSync: true },
    })

    await navigateToTenant(page, tenantSlug, '/courses')
    await page.waitForLoadState('domcontentloaded').catch(() => null)

    await expect(page.getByRole('heading', { name: /^courses$/i })).toBeVisible({ timeout: 15000 })
    const list = page.getByTestId('courses-list')
    await expect(list).toBeVisible({ timeout: 15000 })
    const courseItem = page.getByTestId('course-list-item').filter({ hasText: title })
    await expect(courseItem).toBeVisible()
    await expect(courseItem.getByTestId('course-list-places')).toHaveText('9 places left')
    await expect(
      page.getByTestId('course-list-item').filter({ hasText: 'E2E Past Course' }),
    ).not.toBeVisible()

    await courseItem.click()
    await expect(page).toHaveURL(new RegExp(`/courses/${slug}`))
    await expect(page.getByRole('heading', { name: title })).toBeVisible({ timeout: 15000 })
    await expect(page.getByTestId('course-enroll-panel')).toBeVisible()
    await expect(page.getByText(/6 weeks from purchase|enroll/i).first()).toBeVisible()
  })
})
