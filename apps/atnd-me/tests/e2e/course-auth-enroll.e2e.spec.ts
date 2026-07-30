/**
 * Logged-in user enrolls from /courses/[slug]: PaymentIntent bootstrap + webhook enrollment.
 */
import { test, expect } from './helpers/fixtures'
import { loginAsRegularUserViaApi } from './helpers/auth-helpers'
import { navigateToTenant } from './helpers/subdomain-helpers'
import { createTestEventType, getPayloadInstance } from './helpers/data-helpers'
import { postCoursePurchaseWebhook } from './helpers/stripe-webhook-helpers'

test.describe('Course auth enroll', () => {
  test.describe.configure({ timeout: 120_000 })

  test('logged-in user starts purchase and webhook creates enrollment', async ({
    page,
    testData,
    request,
  }) => {
    const payload = await getPayloadInstance()
    const tenantId = testData.tenants[0]?.id
    const tenantSlug = testData.tenants[0]?.slug
    const userId = testData.users.user1.id
    const w = testData.workerIndex
    if (!tenantId || !tenantSlug || !userId) throw new Error('Tenant/user required')

    const connectAccountId = `acct_e2e_connected_course_auth_${tenantId}_${w}`
    await payload.update({
      collection: 'tenants',
      id: tenantId,
      data: {
        stripeConnectOnboardingStatus: 'active',
        stripeConnectAccountId: connectAccountId,
      },
      overrideAccess: true,
    })

    const eventType = await createTestEventType(tenantId, 'Course Auth Enroll Class', 8, undefined, w)
    const slug = `e2e-course-auth-${w}-${Date.now()}`
    const course = (await payload.create({
      collection: 'courses',
      data: {
        title: `E2E Auth Enroll Course w${w}`,
        slug,
        durationLength: 8,
        durationUnit: 'weeks',
        allowedEventTypes: [eventType.id],
        status: 'open',
        tenant: tenantId,
        priceInformation: { price: 99 },
      },
      overrideAccess: true,
      context: { skipStripeSync: true },
    })) as { id: number }

    await loginAsRegularUserViaApi(page, testData.users.user1.email, 'password', {
      request,
      tenantSlug,
    })

    const purchaseResponsePromise = page.waitForResponse(
      (res) =>
        res.url().includes('/api/courses/purchase') &&
        res.request().method() === 'POST' &&
        res.status() === 200,
      { timeout: 30_000 },
    )

    await navigateToTenant(page, tenantSlug, `/courses/${slug}`)
    const enrollPanel = page.getByTestId('course-enroll-panel')
    await expect(enrollPanel).toBeVisible({ timeout: 20_000 })
    await expect(enrollPanel.getByRole('heading', { name: 'Enroll', exact: true })).toBeVisible()

    const purchaseRes = await purchaseResponsePromise
    const purchaseJson = (await purchaseRes.json()) as {
      clientSecret?: string
      stripeAccountId?: string
    }
    expect(purchaseJson.clientSecret).toMatch(/^pi_test_.*_secret_test$/)
    expect(purchaseJson.stripeAccountId).toBe(connectAccountId)

    await expect(page.getByTestId('stripe-not-configured')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/payment form not available in test mode/i)).toBeVisible()

    const webhook = await postCoursePurchaseWebhook(request, {
      connectAccountId,
      userId,
      tenantId,
      courseId: course.id,
      paymentIntentId: purchaseJson.clientSecret!.replace(/_secret_test$/, ''),
    })
    expect(webhook.status).toBe(200)

    await expect
      .poll(async () => {
        const enrollments = await payload.find({
          collection: 'course-enrollments',
          where: {
            and: [
              { user: { equals: userId } },
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

    const enrollment = (
      await payload.find({
        collection: 'course-enrollments',
        where: {
          and: [
            { user: { equals: userId } },
            { course: { equals: course.id } },
          ],
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
    ).docs[0] as { accessStartsAt?: string; accessEndsAt?: string; status?: string }

    expect(enrollment.status).toBe('active')
    expect(enrollment.accessStartsAt).toBeTruthy()
    expect(enrollment.accessEndsAt).toBeTruthy()
  })
})
