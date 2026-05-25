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
 * E2E tests for checkout-hold return / abandon flows on the manage page.
 */
test.describe('Manage page: checkout holds and checkout return', () => {
  test.describe.configure({ timeout: 90_000 })

  test('entering checkout with confirmed bookings shows Complete Payment and reserved copy', async ({
    page,
    testData,
  }) => {
    const payload = await getPayloadInstance()
    const workerIndex = testData.workerIndex
    const tenant = testData.tenants[0]!
    const user = testData.users.user1

    await updateTenantStripeConnect(tenant.id, {
      stripeConnectOnboardingStatus: 'active',
      stripeConnectAccountId: `acct_hold_edge_${tenant.id}_w${workerIndex}`,
    })

    const dropIn = (await payload.create({
      collection: 'drop-ins',
      data: {
        name: `Hold Edge Drop-in ${tenant.id}-w${workerIndex}-${Date.now()}`,
        isActive: true,
        price: 10,
        adjustable: true,
        tenant: tenant.id,
      },
      overrideAccess: true,
    })) as { id: number }

    const classOption = await createTestEventType(
      tenant.id,
      'Hold Checkout Edge Case Class',
      10,
      undefined,
      workerIndex,
    )

    await payload.update({
      collection: 'event-types',
      id: classOption.id,
      data: { paymentMethods: { allowedDropIn: dropIn.id }, tenant: tenant.id },
      overrideAccess: true,
    })

    const startTime = new Date()
    startTime.setHours(10, 0, 0, 0)
    startTime.setDate(startTime.getDate() + 1 + workerIndex)
    const endTime = new Date(startTime)
    endTime.setHours(11, 0, 0, 0)

    const lesson = await createTestTimeslot(
      tenant.id,
      classOption.id,
      startTime,
      endTime,
      undefined,
      true,
    )

    await createTestBooking(user.id, lesson.id, 'confirmed')
    await createTestBooking(user.id, lesson.id, 'confirmed')

    await loginAsRegularUserViaApi(page, user.email, 'password', {
      tenantSlug: tenant.slug,
    })

    const managePath = `/bookings/${lesson.id}/manage`
    await navigateToTenant(page, tenant.slug, managePath)
    await expect(page.getByTestId('booking-quantity')).toHaveText('2', { timeout: 20_000 })

    const inc = page.getByRole('button', { name: /increase quantity/i })
    for (let i = 0; i < 3; i += 1) {
      await inc.click()
    }
    await page.getByRole('button', { name: /update bookings/i }).click()

    await expect(page.getByText(/complete payment/i).first()).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('pending-booking-quantity')).toHaveText('3', { timeout: 10_000 })
    await expect(page.getByText(/reserved while you checkout/i)).toBeVisible({ timeout: 10_000 })
  })

  test('Cancel on checkout releases hold and shows quantity view with confirmed count', async ({
    page,
    testData,
  }) => {
    const payload = await getPayloadInstance()
    const workerIndex = testData.workerIndex
    const tenant = testData.tenants[0]!
    const user = testData.users.user2 ?? testData.users.user1

    await updateTenantStripeConnect(tenant.id, {
      stripeConnectOnboardingStatus: 'active',
      stripeConnectAccountId: `acct_hold_cancel_${tenant.id}_w${workerIndex}`,
    })

    const dropIn = (await payload.create({
      collection: 'drop-ins',
      data: {
        name: `Hold Cancel Drop-in ${tenant.id}-w${workerIndex}-${Date.now()}`,
        isActive: true,
        price: 10,
        adjustable: true,
        tenant: tenant.id,
      },
      overrideAccess: true,
    })) as { id: number }

    const classOption = await createTestEventType(
      tenant.id,
      'Hold Checkout Cancel Class',
      10,
      undefined,
      workerIndex,
    )

    await payload.update({
      collection: 'event-types',
      id: classOption.id,
      data: { paymentMethods: { allowedDropIn: dropIn.id }, tenant: tenant.id },
      overrideAccess: true,
    })

    const startTime = new Date()
    startTime.setHours(11, 0, 0, 0)
    startTime.setDate(startTime.getDate() + 1 + workerIndex)
    const endTime = new Date(startTime)
    endTime.setHours(12, 0, 0, 0)

    const lesson = await createTestTimeslot(
      tenant.id,
      classOption.id,
      startTime,
      endTime,
      undefined,
      true,
    )

    await createTestBooking(user.id, lesson.id, 'confirmed')
    await createTestBooking(user.id, lesson.id, 'confirmed')

    await loginAsRegularUserViaApi(page, user.email, 'password', {
      tenantSlug: tenant.slug,
    })

    const managePath = `/bookings/${lesson.id}/manage`
    await navigateToTenant(page, tenant.slug, managePath)

    await page.getByRole('button', { name: /increase quantity/i }).click()
    await page.getByRole('button', { name: /increase quantity/i }).click()
    await page.getByRole('button', { name: /update bookings/i }).click()

    await expect(page.getByText(/complete payment/i).first()).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('pending-booking-quantity')).toHaveText('2', { timeout: 10_000 })

    const cancelButton = page.getByRole('button', { name: /^cancel$/i })
    await expect(cancelButton).toBeVisible({ timeout: 5000 })
    await cancelButton.click()

    await expect(page.getByText(/update booking quantity/i).first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('booking-quantity')).toHaveText('2', { timeout: 5000 })

    const holds = await payload.find({
      collection: 'booking-checkout-holds' as import('payload').CollectionSlug,
      where: {
        and: [
          { timeslot: { equals: lesson.id } },
          { user: { equals: user.id } },
          { status: { equals: 'active' } },
        ],
      },
      depth: 0,
      limit: 10,
      overrideAccess: true,
    })
    expect(holds.totalDocs ?? 0).toBe(0)

    const bookings = await payload.find({
      collection: 'bookings',
      where: {
        timeslot: { equals: lesson.id },
        user: { equals: user.id },
      },
      depth: 0,
      limit: 20,
      overrideAccess: true,
    })
    const active = (bookings?.docs ?? []).filter(
      (b: { status?: string }) => String(b?.status ?? '').toLowerCase() !== 'cancelled',
    )
    expect(active.length).toBe(2)
  })
})
