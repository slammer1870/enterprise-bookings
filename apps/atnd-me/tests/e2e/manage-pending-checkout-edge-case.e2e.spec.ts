import { test, expect } from './helpers/fixtures'
import { navigateToTenant } from './helpers/subdomain-helpers'
import { loginAsRegularUser } from './helpers/auth-helpers'
import {
  createTestClassOption,
  createTestLesson,
  createTestBooking,
  getPayloadInstance,
} from './helpers/data-helpers'

/**
 * E2E tests for the "return to checkout" edge case:
 * - User has confirmed + pending bookings, leaves checkout, returns -> sees checkout again.
 * - Cancelling checkout cancels pending in DB; quantity view shows only confirmed.
 * - Reducing quantity when some are pending only removes pending (no "cancel confirmed" prompt for unpaid).
 */
test.describe('Manage page: pending bookings and checkout return', () => {
  test('returning to manage page with pending bookings shows checkout (Complete Payment)', async ({
    page,
    testData,
  }) => {
    const workerIndex = testData.workerIndex
    const tenant = testData.tenants[0]!
    const user = testData.users.user1

    const classOption = await createTestClassOption(
      tenant.id,
      'Pending Checkout Edge Case Class',
      10,
      undefined,
      workerIndex
    )
    const startTime = new Date()
    startTime.setHours(10, 0, 0, 0)
    startTime.setDate(startTime.getDate() + 1 + workerIndex)
    const endTime = new Date(startTime)
    endTime.setHours(11, 0, 0, 0)

    const lesson = await createTestLesson(
      tenant.id,
      classOption.id,
      startTime,
      endTime,
      undefined,
      true
    )

    // 2 confirmed + 3 pending (simulates user added more, went to checkout, then left)
    await createTestBooking(user.id, lesson.id, 'confirmed')
    await createTestBooking(user.id, lesson.id, 'confirmed')
    await createTestBooking(user.id, lesson.id, 'pending')
    await createTestBooking(user.id, lesson.id, 'pending')
    await createTestBooking(user.id, lesson.id, 'pending')

    await loginAsRegularUser(page, 1, user.email, 'password', {
      tenantSlug: tenant.slug,
    })

    const managePath = `/bookings/${lesson.id}/manage`
    await navigateToTenant(page, tenant.slug, managePath)

    // If we were redirected to sign-in (session not sent to subdomain), re-login and retry once
    if (page.url().includes('/auth/sign-in')) {
      await loginAsRegularUser(page, 1, user.email, 'password', {
        tenantSlug: tenant.slug,
      })
      await navigateToTenant(page, tenant.slug, managePath)
    }
    await expect(page).toHaveURL(new RegExp(`/bookings/${lesson.id}/manage`), {
      timeout: 15000,
    })

    // Hydration from server pending should show checkout view (Complete Payment)
    await expect(
      page.getByText(/complete payment/i).first()
    ).toBeVisible({ timeout: 15000 })
    await expect(
      page.getByText(/pending booking/i).first()
    ).toBeVisible({ timeout: 5000 })
  })

  test('Cancel on checkout cancels pending bookings and shows quantity view with confirmed count', async ({
    page,
    testData,
  }) => {
    const workerIndex = testData.workerIndex
    const tenant = testData.tenants[0]!
    const user = testData.users.user2 ?? testData.users.user1

    const classOption = await createTestClassOption(
      tenant.id,
      'Pending Checkout Cancel Class',
      10,
      undefined,
      workerIndex
    )
    const startTime = new Date()
    startTime.setHours(11, 0, 0, 0)
    startTime.setDate(startTime.getDate() + 1 + workerIndex)
    const endTime = new Date(startTime)
    endTime.setHours(12, 0, 0, 0)

    const lesson = await createTestLesson(
      tenant.id,
      classOption.id,
      startTime,
      endTime,
      undefined,
      true
    )

    await createTestBooking(user.id, lesson.id, 'confirmed')
    await createTestBooking(user.id, lesson.id, 'confirmed')
    await createTestBooking(user.id, lesson.id, 'pending')
    await createTestBooking(user.id, lesson.id, 'pending')

    await loginAsRegularUser(page, 1, user.email, 'password', {
      tenantSlug: tenant.slug,
    })

    const managePath = `/bookings/${lesson.id}/manage`
    await navigateToTenant(page, tenant.slug, managePath)
    if (page.url().includes('/auth/sign-in')) {
      await loginAsRegularUser(page, 1, user.email, 'password', {
        tenantSlug: tenant.slug,
      })
      await navigateToTenant(page, tenant.slug, managePath)
    }
    await expect(page).toHaveURL(new RegExp(`/bookings/${lesson.id}/manage`), {
      timeout: 15000,
    })

    await expect(
      page.getByText(/complete payment/i).first()
    ).toBeVisible({ timeout: 15000 })

    const cancelButton = page.getByRole('button', { name: /^cancel$/i })
    await expect(cancelButton).toBeVisible({ timeout: 5000 })
    await cancelButton.click()

    // After Cancel, pending are cancelled in DB; we should see quantity view with 2 bookings
    await expect(
      page.getByText(/update booking quantity/i).first()
    ).toBeVisible({ timeout: 10000 })
    const quantityDisplay = page.getByTestId('booking-quantity')
    await expect(quantityDisplay).toHaveText('2', { timeout: 5000 })

    const payload = await getPayloadInstance()
    const bookings = await payload.find({
      collection: 'bookings',
      where: {
        lesson: { equals: lesson.id },
        user: { equals: user.id },
      },
      depth: 0,
      limit: 20,
      overrideAccess: true,
    })
    const active = (bookings?.docs ?? []).filter(
      (b: any) => String(b?.status ?? '').toLowerCase() !== 'cancelled'
    )
    expect(active.length).toBe(2)
  })
})
