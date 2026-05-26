/**
 * Regression: Booking page multi-slot selection + leaving the page
 * should not crash the site and should release checkout holds.
 */
import { test, expect } from './helpers/fixtures'
import { navigateToTenant } from './helpers/subdomain-helpers'
import { loginAsRegularUserViaApi } from './helpers/auth-helpers'
import {
  createTestEventType,
  createTestTimeslot,
  getPayloadInstance,
} from './helpers/data-helpers'

async function countActiveHolds(
  payload: Awaited<ReturnType<typeof getPayloadInstance>>,
  lessonId: number,
  userId: number,
) {
  const result = await payload.find({
    collection: 'booking-checkout-holds' as import('payload').CollectionSlug,
    where: {
      and: [
        { timeslot: { equals: lessonId } },
        { user: { equals: userId } },
        { status: { equals: 'active' } },
      ],
    },
    depth: 0,
    limit: 20,
    overrideAccess: true,
  })
  return result.totalDocs ?? 0
}

test.describe('Booking page: multi-slot exit with drop-in', () => {
  test('does not crash and releases checkout holds on leave', async ({ page, testData }) => {
    const payload = await getPayloadInstance()
    const tenant = testData.tenants[0]!
    const user = testData.users.user1
    const workerIndex = testData.workerIndex

    await payload.update({
      collection: 'tenants',
      id: tenant.id,
      data: {
        stripeConnectOnboardingStatus: 'active',
        stripeConnectAccountId: `acct_e2e_dropin_exit_${tenant.id}_${workerIndex}`,
      },
      overrideAccess: true,
    })

    const dropIn = (await payload.create({
      collection: 'drop-ins',
      data: {
        name: `E2E Drop-in Exit ${tenant.id}-${workerIndex}-${Date.now()}`,
        isActive: true,
        price: 10,
        adjustable: true,
        tenant: tenant.id,
      },
      overrideAccess: true,
    })) as { id: number }

    const classOption = await createTestEventType(
      tenant.id,
      'Drop-in Exit Multi-slot',
      10,
      undefined,
      workerIndex,
    )

    await payload.update({
      collection: 'event-types',
      id: classOption.id,
      data: {
        paymentMethods: { allowedDropIn: dropIn.id },
        tenant: tenant.id,
      },
      overrideAccess: true,
    })

    const startTime = new Date()
    startTime.setHours(12, 0, 0, 0)
    startTime.setDate(startTime.getDate() + 1 + workerIndex)
    const endTime = new Date(startTime)
    endTime.setHours(13, 0, 0, 0)

    const lesson = await createTestTimeslot(tenant.id, classOption.id, startTime, endTime, undefined, true)

    await loginAsRegularUserViaApi(page, user.email, 'password', {
      tenantSlug: tenant.slug,
    })

    await navigateToTenant(page, tenant.slug, `/bookings/${lesson.id}`)
    await page.waitForLoadState('domcontentloaded').catch(() => null)

    await expect(page.getByText(/payment methods/i).first()).toBeVisible({ timeout: 15000 })
    await page.getByRole('tab', { name: /drop-?in/i }).click()

    await page
      .waitForResponse(
        (r) =>
          r.url().includes('create-payment-intent') &&
          r.request().method() === 'POST' &&
          r.status() === 200,
        { timeout: 20_000 },
      )
      .catch(() => null)

    const inc = page.getByRole('button', { name: /increase quantity/i })
    const holdQuantityResponse = page.waitForResponse(
      (r) =>
        r.url().includes('create-payment-intent') &&
        r.request().method() === 'POST' &&
        r.status() === 200,
      { timeout: 20_000 },
    )
    await inc.click()
    await holdQuantityResponse.catch(() => null)

    // Payment UI load reserves a checkout hold for the selected quantity.
    await expect
      .poll(() => countActiveHolds(payload, lesson.id as number, user.id as number), {
        timeout: 30_000,
      })
      .toBeGreaterThanOrEqual(1)

    // Leave the page – cleanup should release the hold (keepalive may not be observable on goto).
    await navigateToTenant(page, tenant.slug, '/')
    await page.waitForLoadState('domcontentloaded').catch(() => null)

    await expect
      .poll(() => countActiveHolds(payload, lesson.id as number, user.id as number), {
        timeout: 25_000,
      })
      .toBe(0)

    await expect(page).toHaveURL(/\/(home\/?)?$/, { timeout: 15000 })
  })
})
