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

test.describe('Manage page: pending quantity decrement', () => {
  test.describe.configure({ timeout: 90_000 })

  test('decrement does not increase pending bookings', async ({ page, testData }) => {
    const payload = await getPayloadInstance()

    const workerIndex = testData.workerIndex
    const tenant = testData.tenants[0]!
    const user = testData.users.user1

    // Ensure tenant is connected to Stripe so the manage page shows the payment UI.
    await updateTenantStripeConnect(tenant.id, {
      stripeConnectOnboardingStatus: 'active',
      stripeConnectAccountId: `acct_pending_dec_${tenant.id}_w${workerIndex}`,
    })

    // Payment method wiring (drop-in) so the manage page receives a PaymentMethodsComponent.
    const dropIn = (await payload.create({
      collection: 'drop-ins',
      data: {
        name: `E2E Pending Manage Decrement Drop-in ${tenant.id}-w${workerIndex}-${Date.now()}`,
        isActive: true,
        price: 10,
        adjustable: true,
        paymentMethods: ['card'],
        tenant: tenant.id,
      },
      overrideAccess: true,
    })) as { id: number }

    const classOption = await createTestEventType(
      tenant.id,
      'Pending Manage Decrement Class',
      20, // ensures remainingCapacity=10 when we have 10 pending + 0 confirmed
      undefined,
      workerIndex
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

    // Create: 0 confirmed + 10 pending.
    for (let i = 0; i < 10; i++) {
      await createTestBooking(user.id, lesson.id, 'pending')
    }

    await loginAsRegularUserViaApi(page, user.email, 'password', {
      tenantSlug: tenant.slug,
    })

    const managePath = `/bookings/${lesson.id}/manage`
    await navigateToTenant(page, tenant.slug, managePath)

    const pendingQty = page.getByTestId('pending-booking-quantity')
    const pendingDesc = (expected: number) =>
      page.getByText(new RegExp(`You have\\s*${expected}\\s*pending booking(s)?\\s*for this timeslot`, 'i'))

    // Wait for the manage page to hydrate server pending state.
    await expect(pendingQty).toHaveText('10', { timeout: 20_000 })
    await expect(pendingDesc(10)).toBeVisible({ timeout: 20_000 })

    const decBtn = page.getByRole('button', { name: /decrease new bookings/i }).first()

    // Decrement 10 -> 8 in two clicks; the flaky bug would sometimes "flip" the direction.
    await decBtn.click()
    await expect(pendingQty).toHaveText('9', { timeout: 20_000 })
    await expect(pendingDesc(9)).toBeVisible({ timeout: 20_000 })

    await decBtn.click()
    await expect(pendingQty).toHaveText('8', { timeout: 20_000 })
    await expect(pendingDesc(8)).toBeVisible({ timeout: 20_000 })
  })
})

