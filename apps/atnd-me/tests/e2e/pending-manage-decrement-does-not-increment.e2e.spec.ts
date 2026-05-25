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

test.describe('Manage page: checkout hold quantity decrement', () => {
  test.describe.configure({ timeout: 90_000 })

  test('decrement does not increase reserved checkout quantity', async ({ page, testData }) => {
    const payload = await getPayloadInstance()

    const workerIndex = testData.workerIndex
    const tenant = testData.tenants[0]!
    const user = testData.users.user1

    await updateTenantStripeConnect(tenant.id, {
      stripeConnectOnboardingStatus: 'active',
      stripeConnectAccountId: `acct_pending_dec_${tenant.id}_w${workerIndex}`,
    })

    const dropIn = (await payload.create({
      collection: 'drop-ins',
      data: {
        name: `E2E Hold Manage Decrement Drop-in ${tenant.id}-w${workerIndex}-${Date.now()}`,
        isActive: true,
        price: 10,
        adjustable: true,
        tenant: tenant.id,
      },
      overrideAccess: true,
    })) as { id: number }

    const classOption = await createTestEventType(
      tenant.id,
      'Hold Manage Decrement Class',
      20,
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
    startTime.setDate(startTime.getDate() + 2 + workerIndex)
    const endTime = new Date(startTime)
    endTime.setHours(13, 0, 0, 0)

    const lesson = await createTestTimeslot(tenant.id, classOption.id, startTime, endTime, undefined, true)

    await createTestBooking(user.id, lesson.id, 'confirmed')

    await loginAsRegularUserViaApi(page, user.email, 'password', {
      tenantSlug: tenant.slug,
    })

    const managePath = `/bookings/${lesson.id}/manage`
    await navigateToTenant(page, tenant.slug, managePath)

    await expect(page.getByTestId('booking-quantity')).toHaveText('1', { timeout: 20_000 })

    const inc = page.getByRole('button', { name: /increase quantity/i })
    for (let i = 0; i < 10; i += 1) {
      await inc.click()
    }
    await expect(page.getByTestId('booking-quantity')).toHaveText('11', { timeout: 20_000 })
    await page.getByRole('button', { name: /update bookings/i }).click()

    const holdQty = page.getByTestId('pending-booking-quantity')
    await expect(holdQty).toHaveText('10', { timeout: 20_000 })
    await expect(page.getByText(/reserved while you checkout/i)).toBeVisible({ timeout: 20_000 })

    const decBtn = page.getByRole('button', { name: /decrease new bookings/i }).first()

    await decBtn.click()
    await expect(holdQty).toHaveText('9', { timeout: 20_000 })

    await decBtn.click()
    await expect(holdQty).toHaveText('8', { timeout: 20_000 })
  })
})
