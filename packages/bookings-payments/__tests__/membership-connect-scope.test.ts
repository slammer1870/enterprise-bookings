import { beforeEach, describe, expect, it, vi } from "vitest";

type StripeCall = { args: any[] };

type MockStripe = {
  customers: {
    list: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    retrieve: ReturnType<typeof vi.fn>;
  };
  checkout: { sessions: { create: ReturnType<typeof vi.fn> } };
  billingPortal: { sessions: { create: ReturnType<typeof vi.fn> } };
  subscriptions: { list: ReturnType<typeof vi.fn> };
  products: { retrieve: ReturnType<typeof vi.fn> };
};

let stripeCustomersListCalls: StripeCall[] = [];
let stripeCustomersCreateCalls: StripeCall[] = [];
let stripeCheckoutCreateCalls: StripeCall[] = [];
let stripePortalCreateCalls: StripeCall[] = [];
let stripeSubscriptionsListCalls: StripeCall[] = [];
let stripeProductsRetrieveCalls: StripeCall[] = [];

vi.mock("@repo/shared-utils", () => {
  const customers = {
    list: vi.fn(async (...args: any[]) => {
      stripeCustomersListCalls.push({ args });
      const [params, opts] = args;
      const email = params?.email;
      const acct = opts?.stripeAccount ?? null;
      // Simulate no existing customer so code creates it.
      // (We also want to see correct stripeAccount passed.)
      return { data: [], email, acct };
    }),
    create: vi.fn(async (...args: any[]) => {
      stripeCustomersCreateCalls.push({ args });
      const [_params, opts] = args;
      const acct = opts?.stripeAccount ?? null;
      return { id: acct ? `cus_${acct}_1` : "cus_platform_1" };
    }),
    retrieve: vi.fn(async (...args: any[]) => {
      // Not used in these tests; included for completeness.
      return { id: args[0], email: "test@example.com", deleted: false };
    }),
  };

  const checkout = {
    sessions: {
      create: vi.fn(async (...args: any[]) => {
        stripeCheckoutCreateCalls.push({ args });
        return { url: "https://checkout.example/session", client_secret: "cs_test" };
      }),
    },
  };

  const billingPortal = {
    sessions: {
      create: vi.fn(async (...args: any[]) => {
        stripePortalCreateCalls.push({ args });
        return { url: "https://portal.example/session" };
      }),
    },
  };

  const subscriptions = {
    list: vi.fn((...args: any[]) => {
      stripeSubscriptionsListCalls.push({ args });
      const autoPagingToArray = vi.fn().mockResolvedValue([
        {
          id: "sub_1",
          status: "active",
          current_period_start: 1700000000,
          current_period_end: 1700001000,
          cancel_at: null,
          items: { data: [{ plan: { product: "prod_1" } }] },
          customer: { id: "cus_acct_connected_1_1", email: "migrated@example.com", name: "Migrated" },
        },
      ]);
      return { autoPagingToArray };
    }),
  };

  const products = {
    retrieve: vi.fn(async (...args: any[]) => {
      stripeProductsRetrieveCalls.push({ args });
      return {
        id: args[0],
        name: "Plan A",
        default_price: {
          unit_amount: 1000,
          recurring: { interval: "month", interval_count: 1 },
        },
      };
    }),
  };

  const stripe: MockStripe = {
    customers,
    checkout,
    billingPortal,
    subscriptions,
    products,
  };

  return {
    checkRole: () => true,
    stripe,
    // Used by syncStripeSubscriptions
    generatePasswordSaltHash: async () => ({ hash: "hash", salt: "salt" }),
  };
});

// These membership endpoints use Next's dynamic `headers()` helper.
// In unit tests there is no request async store, so we provide a minimal mock.
vi.mock("next/headers.js", () => {
  return {
    headers: async () => ({
      get: (_key: string) => null,
    }),
  };
});

function makePayloadDb() {
  let nextId = 1;
  const users: any[] = [];
  const plans: any[] = [];
  const subscriptions: any[] = [];

  const payload = {
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
    collections: {
      users: { config: { fields: [{ name: "emailVerified" }, { name: "role" }] } },
    },
    findByID: vi.fn(async ({ collection, id }: any) => {
      if (collection === "users") return users.find((u) => u.id === id) ?? null;
      return null;
    }),
    find: vi.fn(async ({ collection, where, limit }: any) => {
      const docsLimit = typeof limit === "number" ? limit : 100;
      if (collection === "users") {
        if (where?.email?.equals) {
          const email = String(where.email.equals).toLowerCase();
          const docs = users.filter((u) => String(u.email).toLowerCase() === email);
          return { docs: docs.slice(0, docsLimit), totalDocs: docs.length };
        }
        if (where?.stripeCustomerId?.equals) {
          const id = String(where.stripeCustomerId.equals);
          const docs = users.filter((u) => u.stripeCustomerId === id);
          return { docs: docs.slice(0, docsLimit), totalDocs: docs.length };
        }
        return { docs: users.slice(0, docsLimit), totalDocs: users.length };
      }
      if (collection === "plans") {
        if (where?.priceJSON?.equals) {
          const docs = plans.filter((p) => p.priceJSON === where.priceJSON.equals);
          return { docs: docs.slice(0, docsLimit), totalDocs: docs.length };
        }
        if (where?.stripeProductId?.equals) {
          const docs = plans.filter((p) => p.stripeProductId === where.stripeProductId.equals);
          return { docs: docs.slice(0, docsLimit), totalDocs: docs.length };
        }
        return { docs: plans.slice(0, docsLimit), totalDocs: plans.length };
      }
      if (collection === "subscriptions") {
        if (where?.stripeSubscriptionId?.equals) {
          const docs = subscriptions.filter(
            (s) => s.stripeSubscriptionId === where.stripeSubscriptionId.equals
          );
          return { docs: docs.slice(0, docsLimit), totalDocs: docs.length };
        }
        if (where?.user?.not_equals === null) {
          const docs = subscriptions.filter((s) => s.user != null);
          return { docs: docs.slice(0, docsLimit), totalDocs: docs.length };
        }
        return { docs: subscriptions.slice(0, docsLimit), totalDocs: subscriptions.length };
      }
      return { docs: [], totalDocs: 0 };
    }),
    create: vi.fn(async ({ collection, data }: any) => {
      const doc = { id: nextId++, ...data };
      if (collection === "users") users.push(doc);
      if (collection === "plans") plans.push(doc);
      if (collection === "subscriptions") subscriptions.push(doc);
      return doc;
    }),
    update: vi.fn(async ({ collection, id, data }: any) => {
      if (collection === "users") {
        const idx = users.findIndex((u) => u.id === id);
        if (idx >= 0) users[idx] = { ...users[idx], ...data };
        return users[idx];
      }
      return null;
    }),
  };

  return { payload, db: { users, plans, subscriptions } };
}

function makeReq(payload: any, overrides?: Partial<any>) {
  return {
    user: { id: 1, email: "user@example.com", name: "User", collection: "users" },
    payload,
    json: async () => ({ price: "price_1", quantity: 1, metadata: { tenantId: "1" } }),
    ...overrides,
  };
}

beforeEach(() => {
  stripeCustomersListCalls = [];
  stripeCustomersCreateCalls = [];
  stripeCheckoutCreateCalls = [];
  stripePortalCreateCalls = [];
  stripeSubscriptionsListCalls = [];
  stripeProductsRetrieveCalls = [];
  vi.clearAllMocks();
});

describe("Option A: Connect as source-of-truth for membership", () => {
  it("creates subscription checkout session on connected account and stores per-account customer mapping (does not set users.stripeCustomerId)", async () => {
    const { createCheckoutSession } = await import(
      "../src/membership/endpoints/create-checkout-session"
    );
    const { payload, db } = makePayloadDb();

    // Existing platform user (no platform stripeCustomerId yet).
    db.users.push({ id: 1, email: "user@example.com", name: "User", stripeCustomerId: "" });

    const handler = createCheckoutSession({
      scope: "connect",
      getStripeAccountIdForRequest: () => "acct_connected_1",
      disableTestShortCircuit: true,
    } as any);

    const res = await handler(makeReq(payload) as any);
    expect(res.status).toBe(200);

    // Created connect customer (scoped)
    expect(stripeCustomersCreateCalls.length).toBe(1);
    const [_createParams, createOpts] = stripeCustomersCreateCalls[0]!.args;
    expect(createOpts).toEqual({ stripeAccount: "acct_connected_1" });

    // Checkout session is created on connect account and uses connect customer ID
    expect(stripeCheckoutCreateCalls.length).toBe(1);
    const [sessionParams, sessionOpts] = stripeCheckoutCreateCalls[0]!.args;
    expect(sessionOpts).toEqual({ stripeAccount: "acct_connected_1" });
    expect(sessionParams.customer).toBe("cus_acct_connected_1_1");

    // User doc should NOT be poisoned with a connect customerId in stripeCustomerId (platform-only)
    const updatedUser = db.users.find((u) => u.id === 1);
    expect(updatedUser?.stripeCustomerId).toBe("");
    expect(updatedUser?.stripeCustomers).toEqual([
      { stripeAccountId: "acct_connected_1", stripeCustomerId: "cus_acct_connected_1_1" },
    ]);
  }, 60000);

  it("creates billing portal session on connected account using per-account mapping", async () => {
    const { createCustomerPortalFactory } = await import(
      "../src/membership/endpoints/create-customer-portal"
    );
    const { payload, db } = makePayloadDb();

    db.users.push({
      id: 1,
      email: "user@example.com",
      name: "User",
      stripeCustomerId: "",
      stripeCustomers: [{ stripeAccountId: "acct_connected_1", stripeCustomerId: "cus_acct_connected_1_1" }],
    });

    const handler = createCustomerPortalFactory({
      scope: "connect",
      getStripeAccountIdForRequest: () => "acct_connected_1",
    } as any);

    const res = await handler(makeReq(payload, { json: async () => ({}) }) as any);
    expect(res.status).toBe(200);

    expect(stripePortalCreateCalls.length).toBe(1);
    const [portalParams, portalOpts] = stripePortalCreateCalls[0]!.args;
    expect(portalOpts).toEqual({ stripeAccount: "acct_connected_1" });
    expect(portalParams.customer).toBe("cus_acct_connected_1_1");
  }, 60000);

  it("syncStripeSubscriptions can sync from a connected account without writing users.stripeCustomerId", async () => {
    const { syncStripeSubscriptions } = await import(
      "../src/membership/lib/sync-stripe-subscriptions"
    );
    const { payload, db } = makePayloadDb();

    const created = (await syncStripeSubscriptions(payload as any, {
      stripeAccountId: "acct_connected_1",
    })) as any[];

    expect(created.length).toBe(1);

    // Stripe calls should have been scoped
    expect(stripeSubscriptionsListCalls.length).toBe(1);
    const [, listOpts] = stripeSubscriptionsListCalls[0]!.args;
    expect(listOpts).toEqual({ stripeAccount: "acct_connected_1" });

    expect(stripeProductsRetrieveCalls.length).toBe(1);
    const [, retrieveParams, retrieveOpts] = stripeProductsRetrieveCalls[0]!.args;
    expect(retrieveParams).toEqual({ expand: ["default_price"] });
    expect(retrieveOpts).toEqual({ stripeAccount: "acct_connected_1" });

    // User created with connect mapping, not platform stripeCustomerId
    const u = db.users.find((x) => x.email === "migrated@example.com");
    expect(u).toBeTruthy();
    expect(u.stripeCustomerId).toBeUndefined();
    expect(u.stripeCustomers).toEqual([
      { stripeAccountId: "acct_connected_1", stripeCustomerId: "cus_acct_connected_1_1" },
    ]);
  }, 60000);
});

