/**
 * Guest enrolls from /courses/[slug]: name/email Continue → guest-checkout PI → webhook enrollment.
 */
import { test, expect } from './helpers/fixtures'
import { navigateToTenant } from './helpers/subdomain-helpers'
import { createTestEventType, getPayloadInstance } from './helpers/data-helpers'
import { postCoursePurchaseWebhook } from './helpers/stripe-webhook-helpers'

test.describe('Course guest enroll', () => {
  test.describe.configure({ timeout: 120_000 })

  test('guest continues to payment and webhook creates enrollment for guest user', async ({
    page,
    testData,
    request,
  }) => {
    const payload = await getPayloadInstance()
    const tenantId = testData.tenants[0]?.id
    const tenantSlug = testData.tenants[0]?.slug
    const w = testData.workerIndex
    if (!tenantId || !tenantSlug) throw new Error('Tenant required')

    const connectAccountId = `acct_e2e_connected_course_guest_${tenantId}_${w}`
    await payload.update({
      collection: 'tenants',
      id: tenantId,
      data: {
        stripeConnectOnboardingStatus: 'active',
        stripeConnectAccountId: connectAccountId,
      },
      overrideAccess: true,
    })

    const eventType = await createTestEventType(
      tenantId,
      'Course Guest Enroll Class',
      8,
      undefined,
      w,
    )
    const slug = `e2e-course-guest-${w}-${Date.now()}`
    const guestEmail = `course-guest-${w}-${Date.now()}@example.com`
    const guestName = 'Sam Guest'

    const course = (await payload.create({
      collection: 'courses',
      data: {
        title: `E2E Guest Enroll Course w${w}`,
        slug,
        durationLength: 4,
        durationUnit: 'weeks',
        allowedEventTypes: [eventType.id],
        status: 'open',
        tenant: tenantId,
        maxEnrollments: 2,
        priceInformation: { price: 80 },
      },
      overrideAccess: true,
      context: { skipStripeSync: true },
    })) as { id: number }

    await navigateToTenant(page, tenantSlug, `/courses/${slug}`)
    await expect(page.getByTestId('course-enroll-panel')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('course-places-remaining')).toContainText(/2 places left/i)

    await page.getByTestId('course-guest-name').fill(guestName)
    await page.getByTestId('course-guest-email').fill(guestEmail)

    const guestCheckoutPromise = page.waitForResponse(
      (res) =>
        res.url().includes('/api/courses/guest-checkout') &&
        res.request().method() === 'POST' &&
        res.status() === 200,
      { timeout: 30_000 },
    )

    await page.getByTestId('course-guest-checkout-continue').click()

    const guestCheckoutRes = await guestCheckoutPromise
    const guestJson = (await guestCheckoutRes.json()) as {
      clientSecret?: string
      stripeAccountId?: string
    }
    expect(guestJson.clientSecret).toMatch(/^pi_test_.*_secret_test$/)
    expect(guestJson.stripeAccountId).toBe(connectAccountId)

    await expect(page.getByTestId('stripe-not-configured')).toBeVisible({ timeout: 15_000 })

    const guestUser = await payload.find({
      collection: 'users',
      where: { email: { equals: guestEmail } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    expect(guestUser.docs).toHaveLength(1)
    const guestUserId = guestUser.docs[0]!.id as number

    const webhook = await postCoursePurchaseWebhook(request, {
      connectAccountId,
      userId: guestUserId,
      tenantId,
      courseId: course.id,
      paymentIntentId: guestJson.clientSecret!.replace(/_secret_test$/, ''),
    })
    expect(webhook.status).toBe(200)

    await expect
      .poll(async () => {
        const enrollments = await payload.find({
          collection: 'course-enrollments',
          where: {
            and: [
              { user: { equals: guestUserId } },
              { course: { equals: course.id } },
              { status: { equals: 'active' } },
            ],
          },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        return enrollments.totalDocs
      }, { timeout: 15_000 })
      .toBe(1)

    // Reload: capacity should drop after a successful purchase.
    await navigateToTenant(page, tenantSlug, `/courses/${slug}`)
    await expect(page.getByTestId('course-enroll-panel')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('course-places-remaining')).toContainText(/1 place left/i)
  })

  test('guest cannot continue with incomplete email', async ({ page, testData }) => {
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
        stripeConnectAccountId: `acct_e2e_connected_course_guest_val_${tenantId}_${w}`,
      },
      overrideAccess: true,
    })

    const eventType = await createTestEventType(
      tenantId,
      'Course Guest Validate Class',
      8,
      undefined,
      w,
    )
    const slug = `e2e-course-guest-val-${w}-${Date.now()}`
    await payload.create({
      collection: 'courses',
      data: {
        title: `E2E Guest Validate Course w${w}`,
        slug,
        durationLength: 2,
        durationUnit: 'weeks',
        allowedEventTypes: [eventType.id],
        status: 'open',
        tenant: tenantId,
        priceInformation: { price: 40 },
      },
      overrideAccess: true,
      context: { skipStripeSync: true },
    })

    await navigateToTenant(page, tenantSlug, `/courses/${slug}`)
    await expect(page.getByTestId('course-enroll-panel')).toBeVisible({ timeout: 20_000 })

    await page.getByTestId('course-guest-name').fill('Sam')
    await page.getByTestId('course-guest-email').fill('sam@ex')
    await page.getByTestId('course-guest-checkout-continue').click()

    await expect(
      page.getByTestId('course-enroll-panel').getByRole('alert'),
    ).toContainText(/complete email/i)
    await expect(page.getByTestId('stripe-not-configured')).toHaveCount(0)
  })
})
