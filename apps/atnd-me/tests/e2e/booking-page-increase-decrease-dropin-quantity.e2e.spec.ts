/**
 * Regression: Booking page checkout quantity can increase/decrease.
 *
 * This specifically validates that the booking page "checkout area" (drop-in tab)
 * allows a user to increase to 7 and decrease to 3 via the quantity selector.
 * It also asserts that the UI totals update, and that `create-payment-intent` requests
 * are being triggered (best-effort) for the corresponding prices.
 */
import { test, expect } from "./helpers/fixtures"
import { navigateToTenant } from "./helpers/subdomain-helpers"
import { loginAsRegularUserViaApi } from "./helpers/auth-helpers"
import {
  createTestEventType,
  createTestTimeslot,
  getPayloadInstance,
} from "./helpers/data-helpers"

test.describe("Booking page: increase/decrease drop-in quantity", () => {
  test.describe.configure({ timeout: 90_000 })

  test("increases to 7 then decreases to 3 from checkout UI", async ({
    page,
    testData,
  }) => {
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
        stripeConnectAccountId: `acct_e2e_dropin_qty_${tenant.id}_${workerIndex}`,
      },
      overrideAccess: true,
    })

    // Create an adjustable drop-in (multi-slot per timeslot).
    const dropIn = (await payload.create({
      collection: "drop-ins",
      data: {
        name: `E2E Drop-in Qty ${tenant.id}-${workerIndex}-${Date.now()}`,
        isActive: true,
        price: 10, // currency units (server converts to cents)
        adjustable: true,
        paymentMethods: ["card"],
        tenant: tenant.id,
      },
      overrideAccess: true,
    })) as { id: number }

    // Create class option and attach the drop-in as an allowed payment method.
    const classOption = await createTestEventType(
      tenant.id,
      "Drop-in Qty Increase/Decrease",
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
    startTime.setDate(startTime.getDate() + 2 + workerIndex)
    const endTime = new Date(startTime)
    endTime.setHours(13, 0, 0, 0)

    const lesson = await createTestTimeslot(tenant.id, classOption.id, startTime, endTime, undefined, true)

    // Simulate legacy data where `originalLockOutTime` might be missing/null.
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

    // Switch to the drop-in tab (quantity selector lives there).
    await page.getByRole("tab", { name: /drop-?in/i }).click()

    const inc = page.getByRole("button", { name: /increase quantity/i })
    const dec = page.getByRole("button", { name: /decrease quantity/i })

    await expect(inc).toBeVisible()
    await expect(dec).toBeVisible()

    const paymentIntentPrices: number[] = []
    page.on("request", (req) => {
      try {
        if (req.method() !== "POST") return
        if (!req.url().includes("create-payment-intent")) return
        const body = req.postDataJSON() as { price?: unknown } | null
        if (body && typeof body.price !== "undefined") paymentIntentPrices.push(Number(body.price))
      } catch {
        // Ignore parse errors; test will assert based on what we successfully captured.
      }
    })

    // Quantity value is rendered between the decrement/increment buttons.
    // Use sibling relationship so we don't accidentally match other numbers on the page.
    const qtyValue = inc.locator('xpath=preceding-sibling::span[1]')

    await expect(qtyValue).toHaveText("1", { timeout: 10_000 })

    // Increase from 1 -> 7.
    for (let i = 0; i < 6; i++) {
      await inc.click()
    }
    await expect(qtyValue).toHaveText("7", { timeout: 20_000 })
    await expect(page.getByText("€70.00")).toBeVisible({ timeout: 20_000 })

    // Decrease from 7 -> 3.
    for (let i = 0; i < 4; i++) {
      await dec.click()
    }
    await expect(qtyValue).toHaveText("3", { timeout: 20_000 })
    await expect(page.getByText("€30.00")).toBeVisible({ timeout: 20_000 })

    // Best-effort server-side confirmation: request prices should track the UI totals.
    // (We don't assert pending bookings rows here because some flows reserve on a later step.)
    expect(paymentIntentPrices).toEqual(expect.arrayContaining([70, 30]))
  })
})

