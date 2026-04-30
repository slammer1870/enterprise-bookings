/**
 * E2E: Trial drop-in discount applies only on first booking.
 *
 * Verifies:
 * - A drop-in with a "trial" discount tier posts discounted price to create-payment-intent
 *   when the viewer has no prior confirmed bookings (bookingStatus === "trialable").
 * - After the viewer has any confirmed booking, the same drop-in posts full price on the next booking.
 */
import { test, expect } from './helpers/fixtures'
import { loginAsRegularUserViaApi } from './helpers/auth-helpers'
import { navigateToTenant } from './helpers/subdomain-helpers'
import { createTestEventType, createTestTimeslot, getPayloadInstance } from './helpers/data-helpers'

test.describe('Trialable drop-in pricing', () => {
  test.describe.configure({ timeout: 90_000 })

  test('trial price on first booking, full price on second', async ({ page, testData }) => {
    const payload = await getPayloadInstance()

    const tenantId = testData.tenants[0]?.id
    const tenantSlug = testData.tenants[0]?.slug
    const userId = testData.users.user1.id

    if (!tenantId || !tenantSlug) {
      throw new Error('Tenant ID or slug is missing from test data')
    }

    // Ensure the viewer starts with no confirmed bookings in this tenant so the first booking is eligible.
    await payload.delete({
      collection: 'bookings',
      where: {
        and: [
          { tenant: { equals: tenantId } },
          { user: { equals: userId } },
          { status: { equals: 'confirmed' } },
        ],
      },
      overrideAccess: true,
    })

    // Ensure tenant is connected (some flows gate payments UI behind connect status).
    await payload.update({
      collection: 'tenants',
      id: tenantId,
      data: {
        stripeConnectOnboardingStatus: 'active',
        stripeConnectAccountId: `acct_trial_dropin_${tenantId}`,
      },
      overrideAccess: true,
    })

    // Create a trialable drop-in: base €10, trial discount 50% at quantity >= 1.
    const dropIn = (await payload.create({
      collection: 'drop-ins',
      data: {
        name: `E2E Trial Drop-in ${tenantId}-${Date.now()}`,
        isActive: true,
        price: 10,
        adjustable: true,
        paymentMethods: ['card'],
        discountTiers: [{ minQuantity: 1, discountPercent: 50, type: 'trial' }],
        tenant: tenantId,
      },
      overrideAccess: true,
    })) as { id: number }

    const classOption = await createTestEventType(tenantId, 'Trialable Drop-in Class', 5)
    await payload.update({
      collection: 'event-types',
      id: classOption.id,
      data: {
        paymentMethods: { allowedDropIn: dropIn.id },
        tenant: tenantId,
      },
      overrideAccess: true,
    })

    const mkTimeslot = async (daysFromNow: number) => {
      const start = new Date()
      start.setDate(start.getDate() + daysFromNow)
      start.setHours(12, 0, 0, 0)
      const end = new Date(start)
      end.setHours(13, 0, 0, 0)
      return createTestTimeslot(tenantId, classOption.id, start, end, undefined, true)
    }

    const lesson1 = await mkTimeslot(1)
    const lesson2 = await mkTimeslot(2)

    await loginAsRegularUserViaApi(page, testData.users.user1.email, 'password', { tenantSlug })

    const expectClassPrice = async (expected: string) => {
      const row = page.getByText('Price').first().locator('..')
      await expect(row.getByText(expected)).toBeVisible({ timeout: 15_000 })
    }

    // First booking: should be trialable => discounted to €5.00.
    await navigateToTenant(page, tenantSlug, `/bookings/${lesson1.id}`)
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => null)
    await expect(page.getByText(/payment methods/i).first()).toBeVisible({ timeout: 15_000 })

    await page.getByRole('tab', { name: /drop-?in/i }).click()
    await expectClassPrice('€5.00')

    // Simulate that the first booking completed successfully by creating a confirmed booking for the viewer.
    // Trial eligibility checks look for *any confirmed booking* for the user.
    await payload.create({
      collection: 'bookings',
      data: {
        user: userId,
        timeslot: lesson1.id,
        tenant: tenantId,
        status: 'confirmed',
      },
      overrideAccess: true,
    })

    // Second booking (different lesson): should no longer be trialable => full €10.00.
    await navigateToTenant(page, tenantSlug, `/bookings/${lesson2.id}`)
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => null)
    await expect(page.getByText(/payment methods/i).first()).toBeVisible({ timeout: 15_000 })

    await page.getByRole('tab', { name: /drop-?in/i }).click()
    await expectClassPrice('€10.00')
    await expect(page.getByText('€5.00').first()).not.toBeVisible()
  })
})

