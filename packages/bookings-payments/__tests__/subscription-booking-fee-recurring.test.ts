import { beforeEach, describe, expect, it, vi } from "vitest";

type MockStripe = {
  prices: { retrieve: ReturnType<typeof vi.fn> };
  customers: { list: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  checkout: { sessions: { create: ReturnType<typeof vi.fn> } };
};

let stripePricesRetrieve: ReturnType<typeof vi.fn>;
let stripeCheckoutCreate: ReturnType<typeof vi.fn>;

vi.mock("@repo/shared-utils", () => {
  stripePricesRetrieve = vi.fn(async (...args: any[]) => {
    // args: (priceId, params, opts?)
    return {
      id: args[0],
      unit_amount: 2500,
      currency: "eur",
      recurring: { interval: "month", interval_count: 1 },
    };
  });

  stripeCheckoutCreate = vi.fn(async () => ({
    url: "https://checkout.example/session",
    client_secret: "cs_test",
  }));

  const stripe: MockStripe = {
    prices: { retrieve: stripePricesRetrieve },
    customers: {
      list: vi.fn(async () => ({ data: [] })),
      create: vi.fn(async () => ({ id: "cus_platform_1" })),
    },
    checkout: { sessions: { create: stripeCheckoutCreate } },
  };

  return {
    checkRole: () => true,
    stripe,
  };
});

vi.mock("next/headers.js", () => {
  return {
    headers: async () => ({
      get: (_key: string) => null,
    }),
  };
});

function makePayloadDb() {
  const users: any[] = [{ id: 1, email: "user@example.com", name: "User", stripeCustomerId: "" }];
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
  return { payload, users };
}

function makeReq(payload: any, overrides?: Partial<any>) {
  return {
    user: { id: 1, email: "user@example.com", name: "User", collection: "users" },
    payload,
    json: async () => ({ price: "price_monthly_1", quantity: 2, metadata: { tenantId: "123" } }),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Subscription booking fee line item", () => {
  it("adds booking fee as a recurring price matching plan interval", async () => {
    const { createCheckoutSession } = await import(
      "../src/membership/endpoints/create-checkout-session"
    );
    const { payload } = makePayloadDb();

    const handler = createCheckoutSession({
      disableTestShortCircuit: true,
      getSubscriptionBookingFeeCents: async () => 199, // €1.99 booking fee every period
    } as any);

    const res = await handler(makeReq(payload) as any);
    expect(res.status).toBe(200);

    expect(stripePricesRetrieve).toHaveBeenCalledTimes(1);

    expect(stripeCheckoutCreate).toHaveBeenCalledTimes(1);
    const [sessionParams] = stripeCheckoutCreate.mock.calls[0] ?? [];
    expect(sessionParams.mode).toBe("subscription");

    const items = sessionParams.line_items as any[];
    expect(items).toHaveLength(2);

    const feeItem = items[1];
    expect(feeItem.quantity).toBe(1);
    expect(feeItem.price_data?.unit_amount).toBe(199);
    expect(feeItem.price_data?.recurring).toEqual({ interval: "month", interval_count: 1 });
  }, 60000);

  it("retrieves the plan price from the connected account when scope=connect", async () => {
    const { createCheckoutSession } = await import(
      "../src/membership/endpoints/create-checkout-session"
    );
    const { payload } = makePayloadDb();

    const handler = createCheckoutSession({
      disableTestShortCircuit: true,
      scope: "connect",
      getStripeAccountIdForRequest: () => "acct_connected_1",
      getSubscriptionBookingFeeCents: async () => 123,
    } as any);

    const res = await handler(makeReq(payload) as any);
    expect(res.status).toBe(200);

    const call = stripePricesRetrieve.mock.calls[0] ?? [];
    // (priceId, params, opts)
    expect(call[0]).toBe("price_monthly_1");
    expect(call[2]).toEqual({ stripeAccount: "acct_connected_1" });
  }, 60000);
});

