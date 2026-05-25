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

test.describe('Manage page: checkout hold decrement after reload', () => {
  test.describe.configure({ timeout: 90_000 })

  test('decrement stays aligned after manage page reload in checkout', async ({ page, testData }) => {
    const payload = await getPayloadInstance()

    const workerIndex = testData.workerIndex
    const tenant = testData.tenants[0]!
    const user = testData.users.user1

    await updateTenantStripeConnect(tenant.id, {
      stripeConnectOnboardingStatus: 'active',
      stripeConnectAccountId: `acct_hold_dec_reload_${tenant.id}_w${workerIndex}`,
    })

    const dropIn = (await payload.create({
      collection: 'drop-ins',
      data: {
        name: `E2E Hold Decrement Reload Drop-in ${tenant.id}-w${workerIndex}-${Date.now()}`,
        isActive: true,
        price: 10,
        adjustable: true,
        tenant: tenant.id,
      },
      overrideAccess: true,
    })) as { id: number }

    const classOption = await createTestEventType(
      tenant.id,
      'Hold Decrement Reload Class',
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

    const inc = page.getByRole('button', { name: /increase quantity/i })
    for (let i = 0; i < 10; i += 1) {
      await inc.click()
    }
    await page.getByRole('button', { name: /update bookings/i }).click()

    const holdQty = page.getByTestId('pending-booking-quantity')
    await expect(holdQty).toHaveText('10', { timeout: 20_000 })

    await page.reload({ waitUntil: 'domcontentloaded' })

    if (!(await holdQty.isVisible().catch(() => false))) {
      const inc = page.getByRole('button', { name: /increase quantity/i })
      for (let i = 0; i < 10; i += 1) {
        await inc.click()
      }
      await page.getByRole('button', { name: /update bookings/i }).click()
      await expect(holdQty).toHaveText('10', { timeout: 20_000 })
    }

    const dec = page.getByRole('button', { name: /decrease new bookings/i }).first()
    await dec.click()
    await expect(holdQty).toHaveText('9', { timeout: 20_000 })
  })
})
