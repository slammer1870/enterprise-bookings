/**
 * Course purchase -> public schedule check-in.
 *
 * A successful course purchase creates an enrollment. That enrollment must then
 * authorize a session included in the course without sending the user through
 * another payment flow.
 */
import { test, expect } from './helpers/fixtures'
import { loginAsRegularUserViaApi } from './helpers/auth-helpers'
import { navigateToTenant } from './helpers/subdomain-helpers'
import { advanceScheduleToDate } from './helpers/schedule-helpers'
import {
  createTestEventType,
  createTestTimeslot,
  getPayloadInstance,
  updateTenantStripeConnect,
} from './helpers/data-helpers'
import { postCoursePurchaseWebhook } from './helpers/stripe-webhook-helpers'

function futureDate(daysFromNow: number, hour: number): Date {
  const date = new Date()
  date.setDate(date.getDate() + daysFromNow)
  date.setHours(hour, 0, 0, 0)
  return date
}

async function getScheduleBookingButton(
  page: any,
  scheduleTitle: string,
  name: RegExp | string = /^book$/i,
) {
  const titles = page.getByText(scheduleTitle, { exact: true })
  await expect(titles.first()).toBeVisible({ timeout: 20_000 })

  for (let index = 0; index < (await titles.count()); index += 1) {
    const row = titles
      .nth(index)
      .locator('xpath=ancestor::div[contains(@class,"border-b")]')
      .first()
    const button = row.getByRole('button', { name })
    if ((await button.count()) > 0) return button
  }

  return titles
    .first()
    .locator('xpath=ancestor::div[contains(@class,"border-b")]')
    .first()
    .getByRole('button', { name })
}

test.describe('Course purchase and public schedule booking', () => {
  test.describe.configure({ timeout: 120_000 })

  test('purchased course enrollment books an allowed session from the public schedule', async ({
    page,
    request,
    testData,
  }) => {
    const payload = await getPayloadInstance()
    const tenant = testData.tenants[0]!
    const user = testData.users.user1
    const workerIndex = testData.workerIndex

    if (!tenant.id || !tenant.slug || !user.id || !user.email) {
      throw new Error('Expected tenant and user fixtures')
    }

    const connectAccountId = `acct_e2e_course_schedule_${tenant.id}_${workerIndex}`
    await updateTenantStripeConnect(tenant.id, {
      stripeConnectOnboardingStatus: 'active',
      stripeConnectAccountId: connectAccountId,
    })

    const eventType = await createTestEventType(
      tenant.id,
      'E2E Purchased Course Session',
      10,
      'Session included with purchased course',
      workerIndex,
    )
    const courseSlug = `e2e-purchase-schedule-${tenant.id}-${workerIndex}-${Date.now()}`
    const course = (await payload.create({
      collection: 'courses',
      data: {
        title: `E2E Purchased Course ${tenant.id}-${workerIndex}`,
        slug: courseSlug,
        durationLength: 8,
        durationUnit: 'weeks',
        allowedEventTypes: [eventType.id],
        status: 'open',
        tenant: tenant.id,
        priceInformation: { price: 99 },
      },
      overrideAccess: true,
      context: { skipStripeSync: true },
    })) as { id: number }

    // This is the authorization relationship used by the public schedule.
    await payload.update({
      collection: 'event-types',
      id: eventType.id,
      data: { paymentMethods: { allowedCourses: [course.id] } },
      overrideAccess: true,
    })

    const startTime = futureDate(6 + workerIndex, 15)
    const lesson = await createTestTimeslot(
      tenant.id,
      eventType.id,
      startTime,
      futureDate(6 + workerIndex, 16),
      undefined,
      true,
    )

    await loginAsRegularUserViaApi(page, user.email, 'password', {
      request,
      tenantSlug: tenant.slug,
    })

    const purchaseResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/courses/purchase') &&
        response.request().method() === 'POST' &&
        response.status() === 200,
      { timeout: 30_000 },
    )

    await navigateToTenant(page, tenant.slug, `/courses/${courseSlug}`)
    await expect(page.getByTestId('course-enroll-panel')).toBeVisible({ timeout: 20_000 })

    const purchaseResponse = await purchaseResponsePromise
    const purchase = (await purchaseResponse.json()) as {
      clientSecret?: string
      stripeAccountId?: string
    }
    expect(purchase.clientSecret).toMatch(/^pi_test_.*_secret_test$/)
    expect(purchase.stripeAccountId).toBe(connectAccountId)

    const paymentIntentId = purchase.clientSecret!.replace(/_secret_test$/, '')
    const webhook = await postCoursePurchaseWebhook(request, {
      connectAccountId,
      userId: user.id,
      tenantId: tenant.id,
      courseId: course.id,
      paymentIntentId,
    })
    expect(webhook.status).toBe(200)

    await expect
      .poll(
        async () => {
          const result = await payload.find({
            collection: 'course-enrollments',
            where: {
              and: [
                { user: { equals: user.id } },
                { course: { equals: course.id } },
                { status: { equals: 'active' } },
              ],
            },
            limit: 1,
            depth: 0,
            overrideAccess: true,
          })
          return result.totalDocs
        },
        { timeout: 15_000 },
      )
      .toBe(1)

    const enrollmentResult = await payload.find({
      collection: 'course-enrollments',
      where: {
        and: [
          { user: { equals: user.id } },
          { course: { equals: course.id } },
          { status: { equals: 'active' } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const enrollment = enrollmentResult.docs[0] as { id: number }

    const scheduleTitle = `${eventType.name}`
    await navigateToTenant(page, tenant.slug, '/')
    await expect(page.getByText(/loading schedule/i))
      .not.toBeVisible({ timeout: 15_000 })
      .catch(() => null)
    await advanceScheduleToDate(page, startTime)

    const bookButton = await getScheduleBookingButton(page, scheduleTitle)
    const bookingResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('bookSingleSlotTimeslotOrRedirect') &&
        response.request().method() === 'POST' &&
        response.status() === 200,
      { timeout: 20_000 },
    )
    await Promise.all([bookingResponsePromise, bookButton.click()])

    // An enrollment is an entitlement, so check-in stays on the public schedule.
    expect(page.url()).not.toMatch(new RegExp(`/bookings/${lesson.id}$`))
    const cancelButton = await getScheduleBookingButton(page, scheduleTitle, /cancel booking/i)
    await expect(cancelButton).toBeVisible({ timeout: 15_000 })

    await expect
      .poll(
        async () => {
          const bookings = await payload.find({
            collection: 'bookings',
            where: {
              and: [
                { timeslot: { equals: lesson.id } },
                { user: { equals: user.id } },
                { status: { equals: 'confirmed' } },
                { paymentMethodUsed: { equals: 'course_enrollment' } },
                { courseEnrollmentIdUsed: { equals: enrollment.id } },
              ],
            },
            limit: 1,
            depth: 0,
            overrideAccess: true,
          })
          return bookings.totalDocs
        },
        { timeout: 15_000 },
      )
      .toBe(1)
  })
})
