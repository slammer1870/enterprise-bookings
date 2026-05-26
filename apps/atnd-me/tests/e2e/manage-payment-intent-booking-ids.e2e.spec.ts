import { test, expect } from './helpers/fixtures'
import { navigateToTenant } from './helpers/subdomain-helpers'
import { loginAsRegularUserViaApi } from './helpers/auth-helpers'
import {
  createTestEventType,
  createTestTimeslot,
  createTestBooking,
  getPayloadInstance,
  updateTenantStripeConnect,
} from './helpers/data-helpers'

/**
 * Manage page checkout POSTs holdId (not pending bookingIds) to create-payment-intent.
 */
test.describe('Manage page: create-payment-intent with holdId', () => {
  test.describe.configure({ timeout: 90_000 })

  test('create-payment-intent succeeds when checkout loads after reserving a hold', async ({
    page,
    testData,
  }) => {
    const payload = await getPayloadInstance()
    const workerIndex = testData.workerIndex
    const tenant = testData.tenants[0]!
    const user = testData.users.user1

    await updateTenantStripeConnect(tenant.id, {
      stripeConnectOnboardingStatus: 'active',
      stripeConnectAccountId: `acct_manage_pi_${tenant.id}_w${workerIndex}`,
    })

    const dropIn = (await payload.create({
      collection: 'drop-ins',
      data: {
        name: `E2E Manage PI Drop-in ${tenant.id}-w${workerIndex}-${Date.now()}`,
        isActive: true,
        price: 15,
        adjustable: true,
        tenant: tenant.id,
      },
      overrideAccess: true,
    })) as { id: number }

    const classOption = await createTestEventType(
      tenant.id,
      'Manage Payment Intent Class',
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
    startTime.setHours(14, 0, 0, 0)
    startTime.setDate(startTime.getDate() + 2 + workerIndex)
    const endTime = new Date(startTime)
    endTime.setHours(15, 0, 0, 0)

    const lesson = await createTestTimeslot(
      tenant.id,
      classOption.id,
      startTime,
      endTime,
      undefined,
      true,
    )

    await createTestBooking(user.id, lesson.id, 'confirmed')

    await loginAsRegularUserViaApi(page, user.email, 'password', {
      tenantSlug: tenant.slug,
    })

    const managePath = `/bookings/${lesson.id}/manage`

    const paymentIntentResponse = page.waitForResponse(
      (res) => {
        if (!res.url().includes('/api/stripe/connect/create-payment-intent')) return false
        const req = res.request()
        if (req.method() !== 'POST') return false
        const postData = req.postData()
        if (!postData) return false
        try {
          const body = JSON.parse(postData) as {
            price?: number
            metadata?: { holdId?: string; timeslotId?: string }
          }
          return (
            typeof body.price === 'number' &&
            body.price > 0 &&
            body.metadata?.timeslotId === String(lesson.id) &&
            typeof body.metadata?.holdId === 'string' &&
            body.metadata.holdId.length > 0
          )
        } catch {
          return false
        }
      },
      { timeout: 30_000 },
    )

    await navigateToTenant(page, tenant.slug, managePath)

    await expect(page.getByText(/update booking quantity/i).first()).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: /increase quantity/i }).click()
    await page.getByRole('button', { name: /update bookings/i }).click()

    await expect(page.getByText(/complete payment/i).first()).toBeVisible({ timeout: 20_000 })

    const res = await paymentIntentResponse
    expect(
      res.ok(),
      `create-payment-intent failed with ${res.status()}: ${await res.text()}`,
    ).toBeTruthy()

    const requestBody = JSON.parse(res.request().postData() ?? '{}') as {
      metadata?: { holdId?: string; bookingIds?: string }
    }
    expect(requestBody.metadata?.holdId).toMatch(/^\d+$/)
    expect(requestBody.metadata?.bookingIds).toBeUndefined()
  })
})
