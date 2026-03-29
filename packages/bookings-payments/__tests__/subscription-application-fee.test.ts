import { beforeEach, describe, expect, it, vi } from "vitest";

let checkoutCreate: ReturnType<typeof vi.fn>;

vi.mock("@repo/shared-utils", () => {
  checkoutCreate = vi.fn(async () => ({ url: "https://checkout.example", client_secret: "cs_test" }));
  const stripe = {
    prices: {
      retrieve: vi.fn(async () => ({
        id: "price_monthly",
        unit_amount: 1000,
        currency: "eur",
        recurring: { interval: "month", interval_count: 1 },
      })),
    },
    customers: {
      list: vi.fn(async () => ({ data: [] })),
      create: vi.fn(async () => ({ id: "cus_acct_connected_1_1" })),
    },
    checkout: { sessions: { create: checkoutCreate } },
  };
  return { checkRole: () => true, stripe };
});

vi.mock("next/headers.js", () => {
  return {
    headers: async () => ({
      get: (_key: string) => null,
    }),
  };
});

function makePayload() {
  const users: any[] = [{ id: 1, email: "user@example.com", name: "User", stripeCustomers: [] }];
  const payload = {
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
    findByID: vi.fn(async ({ collection, id }: any) => {
      if (collection === "users") return users.find((u) => u.id === id) ?? null;
      return null;
    }),
    update: vi.fn(async ({ collection, id, data }: any) => {
      if (collection !== "users") return null;
      const idx = users.findIndex((u) => u.id === id);
      if (idx >= 0) users[idx] = { ...users[idx], ...data };
      return users[idx];
    }),
  };
  return { payload };
}

function makeReq(payload: any) {
  return {
    user: { id: 1, email: "user@example.com", name: "User", collection: "users" },
    payload,
    json: async () => ({ price: "price_monthly", quantity: 1, metadata: { tenantId: "1" } }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Connect subscription application fees", () => {
  it("sets subscription_data.application_fee_percent when configured and scope=connect", async () => {
    const { createCheckoutSession } = await import("../src/membership/endpoints/create-checkout-session");
    const { payload } = makePayload();

    const handler = createCheckoutSession({
      disableTestShortCircuit: true,
      scope: "connect",
      getStripeAccountIdForRequest: () => "acct_connected_1",
      subscriptionApplicationFeePercent: 7.5,
    } as any);

    const res = await handler(makeReq(payload) as any);
    expect(res.status).toBe(200);

    expect(checkoutCreate).toHaveBeenCalledTimes(1);
    const [params, opts] = checkoutCreate.mock.calls[0] ?? [];
    expect(opts).toEqual({ stripeAccount: "acct_connected_1" });
    expect(params.subscription_data?.application_fee_percent).toBe(7.5);
  }, 60000);

  it("does not set application fee when scope=platform (even if configured)", async () => {
    const { createCheckoutSession } = await import("../src/membership/endpoints/create-checkout-session");
    const { payload } = makePayload();

    const handler = createCheckoutSession({
      disableTestShortCircuit: true,
      scope: "platform",
      subscriptionApplicationFeePercent: 7.5,
    } as any);

    const res = await handler(makeReq(payload) as any);
    expect(res.status).toBe(200);

    const [params, opts] = checkoutCreate.mock.calls[0] ?? [];
    expect(opts).toBeUndefined();
    expect(params.subscription_data?.application_fee_percent).toBeUndefined();
  }, 60000);
});

