import { describe, expect, it, vi } from "vitest"

import { confirmBookingsFromPaymentIntent, confirmBookingAndCreateSubscriptionTransaction } from "@/lib/stripe-connect/webhook/confirm-bookings"

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

  it("writes one transaction per booking with that timeslot's branch", async () => {
    const create = vi.fn().mockResolvedValue({ id: 1 })
    const payload = {
      logger: { error: vi.fn() },
      create,
      update: vi.fn().mockResolvedValue({}),
      findByID: vi.fn(async ({ collection, id }: { collection: string; id: number }) => {
        if (collection === "bookings" && id === 1) return { id: 1, timeslot: 10 }
        if (collection === "bookings" && id === 2) return { id: 2, timeslot: 11 }
        if (collection === "timeslots" && id === 10) return { id: 10, branch: 42 }
        if (collection === "timeslots" && id === 11) return { id: 11, branch: 43 }
        throw new Error(`unexpected ${collection} ${id}`)
      }),
    } as any

    await confirmBookingsFromPaymentIntent(payload, [1, 2], {
      paymentIntentId: "pi_cart",
      tenantId: 10,
    })

    const transactions = create.mock.calls
      .map((call) => call[0])
      .filter((args) => args.collection === "transactions")

    expect(transactions).toEqual([
      expect.objectContaining({
        data: expect.objectContaining({ booking: 1, branch: 42 }),
      }),
      expect.objectContaining({
        data: expect.objectContaining({ booking: 2, branch: 43 }),
      }),
    ])
  })

  it("stores the timeslot branch on a subscription booking transaction", async () => {
    const create = vi.fn().mockResolvedValue({ id: 1 })
    const payload = {
      find: vi.fn().mockResolvedValue({ docs: [], totalDocs: 0 }),
      create,
      findByID: vi.fn(async ({ collection, id }: { collection: string; id: number }) => {
        if (collection === "bookings" && id === 7) return { id: 7, timeslot: 10 }
        if (collection === "timeslots" && id === 10) return { id: 10, branch: 42 }
        throw new Error(`unexpected ${collection} ${id}`)
      }),
    } as any

    await confirmBookingAndCreateSubscriptionTransaction(payload, 7, {
      subscriptionId: 3,
      tenantId: 10,
    })

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "transactions",
        data: expect.objectContaining({
          booking: 7,
          paymentMethod: "subscription",
          branch: 42,
        }),
      }),
    )
  })
})

