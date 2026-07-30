/**
 * Enrolled user books an allowed timeslot via the Course payment tab.
 */
import { test, expect } from './helpers/fixtures'
import { loginAsRegularUserViaApi } from './helpers/auth-helpers'
import { navigateToTenant } from './helpers/subdomain-helpers'
import {
  createTestEventType,
  createTestTimeslot,
  getPayloadInstance,
} from './helpers/data-helpers'

async function openBookingPage(args: {
  page: Parameters<typeof test>[0]['page']
  tenantSlug: string
  lessonId: number
}) {
  const { page, tenantSlug, lessonId } = args
  const bookingReady = page
    .getByText(/select quantity|number of slots|book|payment methods/i)
    .first()

  for (let attempt = 0; attempt < 3; attempt++) {
    await navigateToTenant(page, tenantSlug, '/')
    await page.waitForLoadState('domcontentloaded').catch(() => null)
    await navigateToTenant(page, tenantSlug, `/bookings/${lessonId}`)
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null)

    const visible = await bookingReady.isVisible().catch(() => false)
    if (visible) return
    await page.waitForTimeout(process.env.CI ? 3000 : 1500)
  }

  await expect(bookingReady).toBeVisible({ timeout: 15000 })
}

test.describe('Booking with course enrollment', () => {
  test.describe.configure({ timeout: 120_000, mode: 'serial' })

  test('user with active enrollment sees Course tab and can confirm booking', async ({
    page,
    testData,
  }) => {
    test.setTimeout(120_000)
    const payload = await getPayloadInstance()
    const tenantId = testData.tenants[0]?.id
    const tenantSlug = testData.tenants[0]?.slug
    const w = testData.workerIndex
    if (!tenantId || !tenantSlug) throw new Error('Tenant required')

    await payload.update({
      collection: 'tenants',
      id: tenantId,
      data: {
        stripeConnectOnboardingStatus: 'active',
        stripeConnectAccountId: null,
      },
      overrideAccess: true,
    })

    const co = await createTestEventType(tenantId, 'Course Only Class', 5, undefined, w)
    const course = (await payload.create({
      collection: 'courses',
      data: {
        title: `E2E Book Course w${w} ${Date.now()}`,
        slug: `e2e-book-course-${w}-${Date.now()}`,
        durationLength: 8,
        durationUnit: 'weeks',
        allowedEventTypes: [co.id],
        status: 'open',
        tenant: tenantId,
        priceInformation: { price: 99 },
      },
      overrideAccess: true,
      context: { skipStripeSync: true },
    })) as { id: number }

    await payload.update({
      collection: 'event-types',
      id: co.id,
      data: { paymentMethods: { allowedCourses: [course.id] } },
      overrideAccess: true,
    })

    const accessStartsAt = new Date(Date.now() - 86400000).toISOString()
    const accessEndsAt = new Date(Date.now() + 86400000 * 60).toISOString()
    await payload.create({
      collection: 'course-enrollments',
      data: {
        user: testData.users.user1.id,
        tenant: tenantId,
        course: course.id,
        status: 'active',
        accessStartsAt,
        accessEndsAt,
        purchasedAt: new Date().toISOString(),
        transactionId: `e2e_course_book_${w}_${Date.now()}`,
      },
      overrideAccess: true,
    })

    const start = new Date()
    start.setDate(start.getDate() + 2)
    start.setHours(14, 0, 0, 0)
    const end = new Date(start)
    end.setHours(15, 0, 0, 0)
    const lesson = await createTestTimeslot(tenantId, co.id, start, end, undefined, true)

    await new Promise((r) => setTimeout(r, 600))

    await loginAsRegularUserViaApi(page, testData.users.user1.email, 'password', { tenantSlug })
    await openBookingPage({ page, tenantSlug, lessonId: lesson.id })

    await page.waitForTimeout(2000)
    const courseTab = page.getByRole('tab', { name: /^course$/i })
    await expect(courseTab).toBeVisible({ timeout: 15000 })
    await courseTab.click()

    await expect(
      page.getByText(/use this course|confirm with course|use a course enrollment/i).first(),
    ).toBeVisible({ timeout: 15000 })

    const confirmBtn = page
      .getByRole('button', { name: /confirm with course|use this course/i })
      .first()
    await expect(confirmBtn).toBeVisible()
    await confirmBtn.click()

    await expect(page.getByRole('heading', { name: /thank you/i })).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/your booking has been confirmed/i)).toBeVisible()

    await expect
      .poll(async () => {
        const bookings = await payload.find({
          collection: 'bookings',
          where: {
            and: [
              { user: { equals: testData.users.user1.id } },
              { timeslot: { equals: lesson.id } },
              { status: { equals: 'confirmed' } },
            ],
          },
          limit: 5,
          depth: 0,
          overrideAccess: true,
        })
        return bookings.totalDocs
      }, { timeout: 10000 })
      .toBeGreaterThanOrEqual(1)
  })
})
