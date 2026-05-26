/**
 * E2E: User with 0 confirmed but API-created pending bookings is redirected to the manage
 * page and prompted to complete payment.  The manage page auto-cancels the pending rows,
 * creates a checkout hold, and renders the checkout form so the user can pay.
 *
 * Previously (regression scenario) the user would land on the manage page but see only
 * the quantity selector — the Update Bookings button was permanently disabled because
 * desired === active count — leaving them unable to pay.
 */
import { test, expect } from './helpers/fixtures'
import { navigateToTenant } from './helpers/subdomain-helpers'
import { loginAsRegularUserViaApi } from './helpers/auth-helpers'
import {
  createTestEventType,
  createTestTimeslot,
  createTestBooking,
  createAndConfigureTestDropIn,
} from './helpers/data-helpers'

test.describe('Two pending bookings: manage page prompts payment', () => {
  test('user with 0 confirmed and 2 pending is redirected to manage and sees checkout prompt', async ({
    page,
    testData,
  }) => {
    const tenant = testData.tenants[0]!
    const user = testData.users.user1
    const workerIndex = testData.workerIndex

    const classOption = await createTestEventType(
      tenant.id,
      'Two Pending Access Test',
      10,
      undefined,
      workerIndex,
    )

    // Configure a drop-in payment method so the manage page treats this event type as
    // payable, which triggers the auto-cancel-pending + create-checkout-hold flow.
    await createAndConfigureTestDropIn(tenant.id, classOption.id)

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

    await createTestBooking(user.id, lesson.id, 'pending')
    await createTestBooking(user.id, lesson.id, 'pending')

    await loginAsRegularUserViaApi(page, user.email, 'password', {
      tenantSlug: tenant.slug,
    })

    const tenantOrigin = `http://${tenant.slug}.localhost:3000`
    await expect
      .poll(
        async () => {
          const cookies = await page.context().cookies([tenantOrigin])
          return cookies.some((c) =>
            /^(better-auth\.|session_token|session_data|dont_remember)/.test(c.name),
          )
        },
        { timeout: 20_000 },
      )
      .toBe(true)

    // User navigates to /bookings/[id] — redirectToManageIfMultipleBookings fires (2+ non-cancelled
    // bookings) and sends them to /manage.
    await navigateToTenant(page, tenant.slug, `/bookings/${lesson.id}`)
    await page.waitForLoadState('load').catch(() => null)
    await page.waitForTimeout(2000)

    const currentUrl = page.url()

    expect(currentUrl).not.toMatch(/^https?:\/\/[^/]+\/?$/)
    expect(currentUrl).not.toContain('/?')
    expect(currentUrl).toContain('/bookings/')

    // With 2 pending bookings the user is redirected to the manage page.
    expect(currentUrl).toContain(`/bookings/${lesson.id}/manage`)

    const errorHeading = page.getByRole('heading', {
      name: /booking page error|something went wrong/i,
    })
    await expect(errorHeading).not.toBeVisible({ timeout: 3000 })

    // The manage page should cancel the pending bookings, create a checkout hold, and render
    // the checkout form — not the plain quantity selector.
    await expect(page.getByText(/complete payment/i).first()).toBeVisible({ timeout: 20_000 })
  })
})
