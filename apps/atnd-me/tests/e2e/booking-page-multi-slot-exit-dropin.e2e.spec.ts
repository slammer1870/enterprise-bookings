/**
 * Regression: Booking page multi-slot selection + leaving the page
 * should not crash the site and should cancel any pending bookings.
 *
 * Steps:
 * - Configure tenant + lesson with an adjustable drop-in
 * - On `/bookings/[id]`, increase quantity so pending bookings are created
 * - Navigate away immediately (unmount triggers cancelPendingBookingsForTimeslot)
 * - Assert:
 *   - user has no pending bookings for that timeslot
 *   - app navigates successfully to tenant home (/home)
 */
import { test, expect } from "./helpers/fixtures"
import { navigateToTenant } from "./helpers/subdomain-helpers"
import { loginAsRegularUserViaApi } from "./helpers/auth-helpers"
import {
  createTestEventType,
  createTestTimeslot,
  getPayloadInstance,
} from "./helpers/data-helpers"

test.describe("Booking page: multi-slot exit with drop-in", () => {
  test("does not crash and cancels pending bookings", async ({ page, testData }) => {
    const payload = await getPayloadInstance()
    const tenant = testData.tenants[0]!
    const user = testData.users.user1
    const workerIndex = testData.workerIndex

    // Ensure tenant is connected to Stripe so drop-in payment flow is enabled.
    await payload.update({
      collection: "tenants",
      id: tenant.id,
      data: {
        stripeConnectOnboardingStatus: "active",
        stripeConnectAccountId: `acct_e2e_dropin_exit_${tenant.id}_${workerIndex}`,
      },
      overrideAccess: true,
    })

    // Create an adjustable drop-in (allows multiple bookings for the same timeslot).
    const dropIn = (await payload.create({
      collection: "drop-ins",
      data: {
        name: `E2E Drop-in Exit ${tenant.id}-${workerIndex}-${Date.now()}`,
        isActive: true,
        price: 10, // currency units; converted server-side
        adjustable: true,
        paymentMethods: ["card"],
        tenant: tenant.id,
      },
      overrideAccess: true,
    })) as { id: number }

    // Create class option and attach the drop-in as an allowed payment method.
    const classOption = await createTestEventType(
      tenant.id,
      "Drop-in Exit Multi-slot",
      10,
      undefined,
      workerIndex
    )

    await payload.update({
      collection: "event-types",
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

    // Simulate legacy data where `originalLockOutTime` might be missing/null.
    // The afterChange hook should treat it as 0 and never fail booking cancellation.
    await payload
      .update({
        collection: "timeslots",
        id: lesson.id,
        data: {
          lockOutTime: 60,
          originalLockOutTime: null,
        },
        overrideAccess: true,
      })
      .catch(() => null)

    // Login with tenant cookie + session.
    await loginAsRegularUserViaApi(page, user.email, "password", {
      tenantSlug: tenant.slug,
    })

    await navigateToTenant(page, tenant.slug, `/bookings/${lesson.id}`)
    await page.waitForLoadState("domcontentloaded").catch(() => null)

    // Wait for the booking payment UI to be mounted.
    await expect(page.getByText(/payment methods/i).first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole("tab", { name: /drop-?in/i })).toBeVisible()

    // Increase quantity to 2 (creates multiple pending bookings via create-payment-intent).
    await page.getByRole("tab", { name: /drop-?in/i }).click()
    const inc = page.getByRole("button", { name: /increase quantity/i })
    await inc.click()

    // Wait until at least one pending booking exists for this user+timeslot.
    let pendingDocs: any[] = []
    const startedAt = Date.now()
    while (Date.now() - startedAt < 20000) {
      const res = await payload.find({
        collection: "bookings",
        where: {
          and: [
            { timeslot: { equals: lesson.id } },
            { user: { equals: user.id } },
            { status: { equals: "pending" } },
          ],
        },
        depth: 0,
        limit: 20,
        overrideAccess: true,
      })
      pendingDocs = (res.docs ?? []) as any[]
      if (pendingDocs.length >= 1) break
      await page.waitForTimeout(500)
    }

    expect(pendingDocs.length).toBeGreaterThanOrEqual(1)

    // Navigate away quickly. The booking page unmount cleanup cancels pending bookings.
    await navigateToTenant(page, tenant.slug, "/")
    await page.waitForLoadState("domcontentloaded").catch(() => null)
    await page.waitForTimeout(1500)

    // Ensure user has no pending bookings after leaving.
    const after = await payload.find({
      collection: "bookings",
      where: {
        and: [
          { timeslot: { equals: lesson.id } },
          { user: { equals: user.id } },
          { status: { equals: "pending" } },
        ],
      },
      depth: 0,
      limit: 20,
      overrideAccess: true,
    })

    expect((after.docs ?? []).length).toBe(0)

    // Basic health check: tenant home still loads.
    await expect(page).toHaveURL(new RegExp(`/home$`), { timeout: 15000 })
  })
})

