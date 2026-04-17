import { test, expect } from './helpers/fixtures'
import { loginAsRegularUserViaApi } from './helpers/auth-helpers'
import {
  createTestEventType,
  createTestTimeslot,
  createTestBooking,
  getPayloadInstance,
  updateTenantStripeConnect,
} from './helpers/data-helpers'

test.describe('Manage page: pending quantity decrement after reload', () => {
  test.describe.configure({ timeout: 90_000 })

  test('decrement stays aligned after booking-route reload redirect', async ({ page, testData }) => {
    const payload = await getPayloadInstance()

    const workerIndex = testData.workerIndex
    const tenant = testData.tenants[0]!
    const user = testData.users.user1

    // Ensure tenant is connected to Stripe so the manage page shows the payment UI.
    await updateTenantStripeConnect(tenant.id, {
      stripeConnectOnboardingStatus: 'active',
      stripeConnectAccountId: `acct_pending_dec_reload_${tenant.id}_w${workerIndex}`,
    })

    // Payment method wiring (drop-in) so the manage page receives a PaymentMethodsComponent.
    const dropIn = (await payload.create({
      collection: 'drop-ins',
      data: {
        name: `E2E Pending Manage Decrement Reload Drop-in ${tenant.id}-w${workerIndex}-${Date.now()}`,
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
      'Pending Manage Decrement Reload Class',
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

    const bookingPath = `/bookings/${lesson.id}`
    const managePath = `/bookings/${lesson.id}/manage`

    // Reproduction step:
    // - go to booking route
    // - reload
    // - server redirects back to /manage
    const bookingUrl = `http://${tenant.slug}.localhost:3000${bookingPath}`
    await page.goto(bookingUrl, { waitUntil: 'domcontentloaded' })

    // `page.reload()` can be flaky in Next dev (HMR/navigation races).
    // Retry, and if it still fails, fall back to a second navigation.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await page.reload({ waitUntil: 'domcontentloaded' })
        break
      } catch (err) {
        if (attempt === 2) throw err
        await page.goto(bookingUrl, { waitUntil: 'domcontentloaded' })
      }
    }
    await page.waitForURL((url) => url.pathname.includes(managePath), { timeout: 20_000 })

    // Sanity: pending state should hydrate correctly after redirect.
    const pendingQty = page.getByTestId('pending-booking-quantity').first()
    await expect(pendingQty).toHaveText('10', { timeout: 20_000 })

    const readPendingQty = async (): Promise<number> => {
      // Keep reads non-blocking: if the UI temporarily switches views,
      // `textContent()` can hang; use a short timeout.
      // If the pending qty element isn't present, treat it as 0 pending (UI moved past pending state).
      const raw = await pendingQty.textContent({ timeout: 1_000 }).catch(() => null)
      if (raw == null) return 0
      const n = Number.parseInt(raw.trim(), 10)
      return Number.isFinite(n) ? n : 0
    }

    // Decrement repeatedly. The production bug flaps the pending count upwards
    // after the UI updates; we verify it never exceeds the user target.
    // Stop early if the UI no longer shows the pending decrement controls.
    let currentExpected = 10
    const maxDecrements = 5

    for (let i = 0; i < maxDecrements; i++) {
      const nextExpected = currentExpected - 1
      const dec = page.getByRole('button', { name: /decrease new bookings/i }).first()

      if (!(await dec.isVisible().catch(() => false))) {
        // Pending controls aren't visible (UI transitioned). Still require that
        // reported pending doesn't exceed the target.
        expect(await readPendingQty()).toBeLessThanOrEqual(nextExpected)
        break
      }

      await dec.click()

      await expect.poll(() => readPendingQty(), { timeout: 20_000 }).toBeLessThanOrEqual(nextExpected)

      // Wait long enough for the background process / state sync to run.
      await page.waitForTimeout(4_000)
      expect(await readPendingQty()).toBeLessThanOrEqual(nextExpected)

      currentExpected = nextExpected
    }

    // If a redirect or background reconciliation happens after the final click,
    // make sure we're still on the manage page to keep the test deterministic.
    expect(page.url()).toContain(managePath)
  })
})

