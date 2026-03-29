import { beforeEach, describe, expect, it, vi } from "vitest";

type MockStripe = {
  subscriptions: { retrieve: ReturnType<typeof vi.fn> };
};

let stripeRetrieve: ReturnType<typeof vi.fn>;

vi.mock("@repo/shared-utils", () => {
  stripeRetrieve = vi.fn();
  const stripe: MockStripe = {
    subscriptions: { retrieve: stripeRetrieve },
  };
  return { stripe };
});

function makePayloadDb(initialUser: any) {
  const state = {
    user: { ...initialUser },
    updateCalls: [] as any[],
    findByIDCalls: [] as any[],
  };

  const payload = {
    logger: { info: vi.fn(), error: vi.fn() },
    findByID: vi.fn(async (args: any) => {
      state.findByIDCalls.push(args);
      if (args?.collection === "users" || String(args?.collection) === "users") {
        if (Number(args?.id) === Number(state.user.id)) return state.user;
        return null;
      }
      return null;
    }),
    update: vi.fn(async (args: any) => {
      state.updateCalls.push(args);
      if ((args?.collection === "users" || String(args?.collection) === "users") && Number(args?.id) === state.user.id) {
        state.user = { ...state.user, ...(args?.data ?? {}) };
      }
      return { ...args?.data, id: args?.id };
    }),
  };

  return { payload, state };
}

describe("createBeforeSubscriptionChange (connect scope) strict mapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks when scope=connect but no connected account resolved", async () => {
    const { createBeforeSubscriptionChange } = await import(
      "../src/membership/hooks/before-subscription-change"
    );
    const hook = createBeforeSubscriptionChange({
      scope: "connect",
      getStripeAccountIdForRequest: () => null,
    });

    const { payload } = makePayloadDb({ id: 1, stripeCustomers: [] });
    const req = { payload };

    await expect(
      hook({
        data: { user: 1, stripeSubscriptionId: "sub_1" } as any,
        req: req as any,
      } as any)
    ).rejects.toThrow(/No connected Stripe account resolved/i);
  });

  it("retrieves subscription on connected account, sets stripeAccountId+stripeCustomerId, and upserts mapping when missing", async () => {
    const { createBeforeSubscriptionChange } = await import(
      "../src/membership/hooks/before-subscription-change"
    );
    const hook = createBeforeSubscriptionChange({
      scope: "connect",
      getStripeAccountIdForRequest: () => "acct_connected_1",
    });

    stripeRetrieve.mockResolvedValue({
      id: "sub_1",
      customer: "cus_123",
      current_period_start: 100,
      current_period_end: 200,
      status: "active",
      cancel_at: null,
      items: { data: [{ quantity: 3 }] },
    });

    const { payload, state } = makePayloadDb({ id: 1, stripeCustomers: [] });
    const req = { payload };

    const res = await hook({
      data: { user: 1, stripeSubscriptionId: "sub_1" } as any,
      req: req as any,
    } as any);

    // Stripe request should be scoped to Connect account
    expect(stripeRetrieve).toHaveBeenCalled();
    const retrieveArgs = stripeRetrieve.mock.calls[0] ?? [];
    expect(retrieveArgs[0]).toBe("sub_1");
    expect(retrieveArgs[2]).toEqual({ stripeAccount: "acct_connected_1" });

    // Hook output should include linkage + synced fields
    expect(res).toMatchObject({
      stripeAccountId: "acct_connected_1",
      stripeCustomerId: "cus_123",
      status: "active",
      quantity: 3,
    });
    expect(typeof (res as any).startDate).toBe("string");
    expect(typeof (res as any).endDate).toBe("string");

    // Should have stored mapping on the user
    expect(state.updateCalls.length).toBeGreaterThan(0);
    expect(state.user.stripeCustomers).toEqual([
      { stripeAccountId: "acct_connected_1", stripeCustomerId: "cus_123" },
    ]);
  });

  it("blocks when stored per-account mapping exists but points to a different customer", async () => {
    const { createBeforeSubscriptionChange } = await import(
      "../src/membership/hooks/before-subscription-change"
    );
    const hook = createBeforeSubscriptionChange({
      scope: "connect",
      getStripeAccountIdForRequest: () => "acct_connected_1",
    });

    stripeRetrieve.mockResolvedValue({
      id: "sub_1",
      customer: "cus_123",
      current_period_start: 100,
      current_period_end: 200,
      status: "active",
      cancel_at: null,
      items: { data: [{ quantity: 1 }] },
    });

    const { payload } = makePayloadDb({
      id: 1,
      stripeCustomers: [{ stripeAccountId: "acct_connected_1", stripeCustomerId: "cus_other" }],
    });
    const req = { payload };

    await expect(
      hook({
        data: { user: 1, stripeSubscriptionId: "sub_1" } as any,
        req: req as any,
      } as any)
    ).rejects.toThrow(/does not match this user's stored customer mapping/i);
  });

  it("blocks when record already has stripeAccountId that mismatches resolved tenant account", async () => {
    const { createBeforeSubscriptionChange } = await import(
      "../src/membership/hooks/before-subscription-change"
    );
    const hook = createBeforeSubscriptionChange({
      scope: "connect",
      getStripeAccountIdForRequest: () => "acct_connected_1",
    });

    const { payload } = makePayloadDb({ id: 1, stripeCustomers: [] });
    const req = { payload };

    await expect(
      hook({
        data: {
          user: 1,
          stripeSubscriptionId: "sub_1",
          stripeAccountId: "acct_connected_2",
        } as any,
        req: req as any,
      } as any)
    ).rejects.toThrow(/Stripe account mismatch/i);
  });

  it("does nothing when skipSync=true (does not call Stripe)", async () => {
    const { createBeforeSubscriptionChange } = await import(
      "../src/membership/hooks/before-subscription-change"
    );
    const hook = createBeforeSubscriptionChange({
      scope: "connect",
      getStripeAccountIdForRequest: () => "acct_connected_1",
    });

    const { payload } = makePayloadDb({ id: 1, stripeCustomers: [] });
    const req = { payload };

    const res = await hook({
      data: { user: 1, stripeSubscriptionId: "sub_1", skipSync: true } as any,
      req: req as any,
    } as any);

    expect(stripeRetrieve).not.toHaveBeenCalled();
    expect(res).toMatchObject({ skipSync: false, stripeSubscriptionId: "sub_1" });
  });
});

