import { beforeEach, describe, expect, it, vi } from "vitest";

type MockStripe = {
  products: { list: ReturnType<typeof vi.fn> };
  subscriptions: { list: ReturnType<typeof vi.fn> };
  customers: { list: ReturnType<typeof vi.fn> };
};

let stripeListProducts: ReturnType<typeof vi.fn>;
let stripeListSubscriptions: ReturnType<typeof vi.fn>;
let stripeListCustomers: ReturnType<typeof vi.fn>;

vi.mock("@repo/shared-utils", () => {
  const makeList = (items: unknown[]) => {
    const autoPagingToArray = vi.fn().mockResolvedValue(items);
    const list = vi.fn().mockReturnValue({ autoPagingToArray });
    return { list, autoPagingToArray };
  };

  const products = makeList([
    // recurring price product
    { id: "prod_recurring", default_price: { type: "recurring" } },
    // one-time price product
    { id: "prod_one_time", default_price: { type: "one_time" } },
    // no default price
    { id: "prod_none", default_price: null },
  ]);
  const subscriptions = makeList([{ id: "sub_123", customer: { email: "a@b.com" } }]);
  const customers = makeList([{ id: "cus_123", email: "a@b.com" }]);

  stripeListProducts = products.list;
  stripeListSubscriptions = subscriptions.list;
  stripeListCustomers = customers.list;

  const stripe: MockStripe = {
    products: { list: products.list },
    subscriptions: { list: subscriptions.list },
    customers: { list: customers.list },
  };

  return {
    // Treat everyone as admin for these unit tests.
    checkRole: () => true,
    stripe,
  };
});

function makeReq(overrides?: Partial<any>) {
  return {
    user: { id: 1, roles: ["admin"] },
    payload: { logger: { info: vi.fn(), error: vi.fn() } },
    ...overrides,
  };
}

async function json(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text) as any;
  } catch {
    return text;
  }
}

describe("Stripe proxy endpoints scoping + meta", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET /stripe/plans returns meta.stripeAccountId and uses stripeAccount when provided", async () => {
    const { createPlansProxy } = await import("../src/membership/endpoints/plans");

    const handler = createPlansProxy({
      enabled: true,
      getStripeAccountIdForRequest: () => "acct_connected_1",
    });

    const res = await handler(makeReq() as any);
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body.meta).toEqual({ stripeAccountId: "acct_connected_1" });

    // It should pass stripeAccount options when listing
    expect(stripeListProducts).toHaveBeenCalled();
    const [, stripeOpts] = stripeListProducts.mock.calls[0] ?? [];
    expect(stripeOpts).toEqual({ stripeAccount: "acct_connected_1" });

    // It should filter to recurring
    expect(body.data.map((p: any) => p.id)).toEqual(["prod_recurring"]);
  });

  it("GET /stripe/plans returns 400 when scope=connect but no account resolved", async () => {
    const { createPlansProxy } = await import("../src/membership/endpoints/plans");

    const handler = createPlansProxy({
      enabled: true,
      scope: "connect",
      getStripeAccountIdForRequest: () => null,
    } as any);

    const res = await handler(makeReq() as any);
    expect(res.status).toBe(400);
  });

  it("GET /stripe/plans returns meta.stripeAccountId=null when no account is resolved", async () => {
    const { createPlansProxy } = await import("../src/membership/endpoints/plans");

    const handler = createPlansProxy({ enabled: true });
    const res = await handler(makeReq() as any);
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body.meta).toEqual({ stripeAccountId: null });

    const [, stripeOpts] = stripeListProducts.mock.calls[0] ?? [];
    expect(stripeOpts).toBeUndefined();
  });

  it("GET /stripe/class-pass-products returns meta.stripeAccountId and filters to one_time", async () => {
    const { createClassPassProductsProxy } = await import(
      "../src/class-pass/endpoints/class-pass-products"
    );

    const handler = createClassPassProductsProxy({
      enabled: true,
      getStripeAccountIdForRequest: () => "acct_connected_2",
    });

    const res = await handler(makeReq() as any);
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body.meta).toEqual({ stripeAccountId: "acct_connected_2" });

    const [, stripeOpts] = stripeListProducts.mock.calls[0] ?? [];
    expect(stripeOpts).toEqual({ stripeAccount: "acct_connected_2" });

    expect(body.data.map((p: any) => p.id)).toEqual(["prod_one_time"]);
  });

  it("GET /stripe/class-pass-products returns 400 when scope=connect but no account resolved", async () => {
    const { createClassPassProductsProxy } = await import(
      "../src/class-pass/endpoints/class-pass-products"
    );

    const handler = createClassPassProductsProxy({
      enabled: true,
      productsProxyScope: "connect",
      getStripeAccountIdForRequest: () => null,
    } as any);

    const res = await handler(makeReq() as any);
    expect(res.status).toBe(400);
  });

  it("GET /stripe/subscriptions supports connect scope and returns meta.stripeAccountId", async () => {
    const { createSubscriptionsProxy } = await import(
      "../src/membership/endpoints/subscriptions"
    );

    const handler = createSubscriptionsProxy({
      enabled: true,
      subscriptionsProxyScope: "connect",
      getStripeAccountIdForRequest: () => "acct_connected_3",
    });

    const res = await handler(makeReq() as any);
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body.meta).toEqual({ stripeAccountId: "acct_connected_3" });

    expect(stripeListSubscriptions).toHaveBeenCalled();
    const [, stripeOpts] = stripeListSubscriptions.mock.calls[0] ?? [];
    expect(stripeOpts).toEqual({ stripeAccount: "acct_connected_3" });
  });

  it("GET /stripe/subscriptions returns 400 when scope=connect but no account resolved", async () => {
    const { createSubscriptionsProxy } = await import(
      "../src/membership/endpoints/subscriptions"
    );

    const handler = createSubscriptionsProxy({
      enabled: true,
      subscriptionsProxyScope: "connect",
      getStripeAccountIdForRequest: () => null,
    });

    const res = await handler(makeReq() as any);
    expect(res.status).toBe(400);
  });

  it("GET /stripe/customers returns meta.stripeAccountId and uses stripeAccount when provided", async () => {
    const { createCustomersProxy } = await import("../src/payments/endpoints/customers");

    const handler = createCustomersProxy({
      scope: "connect",
      getStripeAccountIdForRequest: () => "acct_connected_4",
    });

    const res = await handler(makeReq() as any);
    expect(res.status).toBe(200);
    const body = await json(res);

    expect(body.meta).toEqual({ stripeAccountId: "acct_connected_4" });
    expect(stripeListCustomers).toHaveBeenCalled();
    const [, stripeOpts] = stripeListCustomers.mock.calls[0] ?? [];
    expect(stripeOpts).toEqual({ stripeAccount: "acct_connected_4" });
  });
});

