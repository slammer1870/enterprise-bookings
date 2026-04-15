import { describe, expect, it, vi } from "vitest"

import { confirmBookingsFromPaymentIntent } from "@/lib/stripe-connect/webhook/confirm-bookings"

describe("confirmBookingsFromPaymentIntent (batch)", () => {
  it("does not throw if confirming one booking fails", async () => {
    const payload = {
      logger: {
        error: vi.fn(),
      },
      create: vi.fn().mockResolvedValue({ id: 1 }),
      update: vi.fn(async ({ id }: { id: number }) => {
        if (id === 2) throw new Error("update failed for booking 2")
        return { id }
      }),
    } as any

    await expect(
      confirmBookingsFromPaymentIntent(payload, [1, 2, 3], {
        paymentIntentId: "pi_test_123",
        tenantId: 10,
      })
    ).resolves.toBeUndefined()

    expect(payload.logger.error).toHaveBeenCalledTimes(1)
  })
})

