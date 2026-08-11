import { describe, expect, it, vi } from "vitest";
import { applyCancelRefundPolicy } from "../src/cancel-refund-policy";

function createPayloadMock(opts: {
  booking: Record<string, unknown>;
  timeslot: Record<string, unknown>;
  tenant: Record<string, unknown>;
  transaction: Record<string, unknown>;
  classPass?: Record<string, unknown>;
  siblingTransactions?: Record<string, unknown>[];
}) {
  const updates: Array<{ collection: string; id: number; data: Record<string, unknown> }> = [];
  const payload = {
    findByID: vi.fn(async ({ collection, id }: { collection: string; id: number }) => {
      if (collection === "bookings") return { ...opts.booking, id };
      if (collection === "timeslots") return { ...opts.timeslot, id };
      if (collection === "tenants") return { ...opts.tenant, id };
      if (collection === "class-passes") return { ...opts.classPass, id };
      return null;
    }),
    find: vi.fn(async ({ collection, where }: { collection: string; where: any }) => {
      if (collection === "transactions") {
        if (where?.booking?.equals != null) {
          return { docs: [opts.transaction], totalDocs: 1 };
        }
        if (where?.and) {
          return {
            docs: opts.siblingTransactions ?? [opts.transaction],
            totalDocs: (opts.siblingTransactions ?? [opts.transaction]).length,
          };
        }
      }
      return { docs: [], totalDocs: 0 };
    }),
    update: vi.fn(
      async ({
        collection,
        id,
        data,
      }: {
        collection: string;
        id: number;
        data: Record<string, unknown>;
      }) => {
        updates.push({ collection, id, data });
        if (collection === "class-passes" && opts.classPass) {
          Object.assign(opts.classPass, data);
        }
        if (collection === "transactions") {
          Object.assign(opts.transaction, data);
        }
        return { id, ...data };
      },
    ),
    logger: { error: vi.fn() },
  };
  return { payload: payload as any, updates };
}

describe("applyCancelRefundPolicy", () => {
  const start = "2026-08-20T12:00:00.000Z";
  const inside = new Date("2026-08-19T10:00:00.000Z");

  it("restores class-pass credit inside window", async () => {
    const classPass = { id: 9, quantity: 0, status: "used" };
    const transaction = {
      id: 3,
      paymentMethod: "class_pass",
      classPassId: 9,
      classPassRestoredAt: null,
    };
    const { payload, updates } = createPayloadMock({
      booking: {
        id: 1,
        status: "cancelled",
        timeslot: { id: 2, startTime: start },
        tenant: 5,
      },
      timeslot: { id: 2, startTime: start, tenant: 5 },
      tenant: {
        id: 5,
        refundPolicy: { defaultWindowHours: 24 },
        stripeConnectOnboardingStatus: "active",
        stripeConnectAccountId: "acct_test",
      },
      transaction,
      classPass,
    });

    const result = await applyCancelRefundPolicy({
      payload,
      booking: {
        id: 1,
        status: "cancelled",
        timeslot: { id: 2, startTime: start },
        tenant: 5,
      },
      now: inside,
    });

    expect(result).toEqual({ applied: true, kind: "class_pass" });
    expect(classPass.quantity).toBe(1);
    expect(classPass.status).toBe("active");
    expect(updates.some((u) => u.collection === "transactions")).toBe(true);
  });

  it("does not restore class-pass credit outside window", async () => {
    const classPass = { id: 9, quantity: 0, status: "used" };
    const { payload } = createPayloadMock({
      booking: {
        id: 1,
        status: "cancelled",
        timeslot: { id: 2, startTime: start },
        tenant: 5,
      },
      timeslot: { id: 2, startTime: start, tenant: 5 },
      tenant: {
        id: 5,
        refundPolicy: { defaultWindowHours: 24 },
      },
      transaction: {
        id: 3,
        paymentMethod: "class_pass",
        classPassId: 9,
      },
      classPass,
    });

    const result = await applyCancelRefundPolicy({
      payload,
      booking: {
        id: 1,
        status: "cancelled",
        timeslot: { id: 2, startTime: start },
        tenant: 5,
      },
      now: new Date("2026-08-20T11:00:00.000Z"),
    });

    expect(result.applied).toBe(false);
    expect(classPass.quantity).toBe(0);
  });

  it("calls Stripe refund callback inside window and marks transaction", async () => {
    const transaction = {
      id: 3,
      paymentMethod: "stripe",
      stripePaymentIntentId: "pi_123",
      refundedAt: null,
      stripeRefundId: null,
    };
    const { payload } = createPayloadMock({
      booking: {
        id: 1,
        status: "cancelled",
        timeslot: { id: 2, startTime: start },
        tenant: 5,
      },
      timeslot: { id: 2, startTime: start, tenant: 5 },
      tenant: {
        id: 5,
        refundPolicy: { defaultWindowHours: 24 },
        stripeConnectAccountId: "acct_123",
        stripeConnectOnboardingStatus: "active",
      },
      transaction,
      siblingTransactions: [transaction],
    });

    const refundStripePaymentIntent = vi.fn(async () => ({ refundId: "re_abc" }));

    const result = await applyCancelRefundPolicy({
      payload,
      booking: {
        id: 1,
        status: "cancelled",
        timeslot: { id: 2, startTime: start },
        tenant: 5,
      },
      refundStripePaymentIntent,
      now: inside,
    });

    expect(result).toEqual({ applied: true, kind: "stripe" });
    expect(refundStripePaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentIntentId: "pi_123",
        stripeAccountId: "acct_123",
        siblingCount: 1,
      }),
    );
    expect(transaction.stripeRefundId).toBe("re_abc");
    expect(transaction.refundedAt).toBeTruthy();
  });

  it("skips when default policy unset", async () => {
    const refundStripePaymentIntent = vi.fn();
    const { payload } = createPayloadMock({
      booking: {
        id: 1,
        status: "cancelled",
        timeslot: { id: 2, startTime: start },
        tenant: 5,
      },
      timeslot: { id: 2, startTime: start, tenant: 5 },
      tenant: { id: 5, refundPolicy: {} },
      transaction: {
        id: 3,
        paymentMethod: "stripe",
        stripePaymentIntentId: "pi_123",
      },
    });

    const result = await applyCancelRefundPolicy({
      payload,
      booking: {
        id: 1,
        status: "cancelled",
        timeslot: { id: 2, startTime: start },
        tenant: 5,
      },
      refundStripePaymentIntent,
      now: inside,
    });

    expect(result.applied).toBe(false);
    expect(refundStripePaymentIntent).not.toHaveBeenCalled();
  });
});
