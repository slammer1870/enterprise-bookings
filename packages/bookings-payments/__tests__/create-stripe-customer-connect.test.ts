import { beforeEach, describe, expect, it, vi } from "vitest";

type StripeCall = { args: any[] };

let stripeCustomersListCalls: StripeCall[] = [];
let stripeCustomersCreateCalls: StripeCall[] = [];

vi.mock("@repo/shared-utils", () => {
  const customers = {
    list: vi.fn(async (...args: any[]) => {
      stripeCustomersListCalls.push({ args });
      return { data: [] };
    }),
    create: vi.fn(async (...args: any[]) => {
      stripeCustomersCreateCalls.push({ args });
      const [_params, opts] = args;
      const acct = opts?.stripeAccount ?? null;
      return { id: acct ? `cus_${acct}_1` : "cus_platform_1" };
    }),
  };

  return { stripe: { customers } };
});

beforeEach(() => {
  stripeCustomersListCalls = [];
  stripeCustomersCreateCalls = [];
  vi.clearAllMocks();
});

describe("createStripeCustomer hook (tenant connect scoping)", () => {
  it("creates Stripe customer on connected account when tenant has active connect account", async () => {
    const { createStripeCustomer } = await import(
      "../src/payments/hooks/create-stripe-customer"
    );

    const req = {
      context: { tenant: 123 },
      payload: {
        logger: { error: vi.fn() },
        findByID: vi.fn(async ({ collection, id }: any) => {
          if (collection !== "tenants") return null;
          if (id !== 123) return null;
          return {
            id: 123,
            stripeConnectAccountId: "acct_connected_123",
            stripeConnectOnboardingStatus: "active",
          };
        }),
      },
    };

    const res = await createStripeCustomer({
      operation: "create",
      req: req as any,
      data: {
        email: "user@example.com",
        name: "User",
        stripeCustomerId: "",
      } as any,
    } as any);

    expect(stripeCustomersCreateCalls.length).toBe(1);
    const [_createParams, createOpts] = stripeCustomersCreateCalls[0]!.args;
    expect(createOpts).toEqual({ stripeAccount: "acct_connected_123" });

    expect(res.stripeCustomerId).toBe("");
    expect(res.stripeCustomers).toEqual([
      { stripeAccountId: "acct_connected_123", stripeCustomerId: "cus_acct_connected_123_1" },
    ]);
  });

  it("does not create a platform customer when tenant is known but Connect is not active", async () => {
    const { createStripeCustomer } = await import(
      "../src/payments/hooks/create-stripe-customer"
    );

    const req = {
      context: { tenant: 123 },
      payload: {
        logger: { error: vi.fn() },
        findByID: vi.fn(async () => ({
          id: 123,
          stripeConnectAccountId: "",
          stripeConnectOnboardingStatus: "not_connected",
        })),
      },
    };

    const res = await createStripeCustomer({
      operation: "create",
      req: req as any,
      data: { email: "user@example.com", name: "User", stripeCustomerId: "" } as any,
    } as any);

    expect(stripeCustomersCreateCalls.length).toBe(0);
    expect(stripeCustomersListCalls.length).toBe(0);
    expect(res.stripeCustomerId).toBe("");
  });

  it("creates a platform customer only when there is no tenant signup context", async () => {
    const { createStripeCustomer } = await import(
      "../src/payments/hooks/create-stripe-customer"
    );

    const req = {
      context: {},
      payload: {
        logger: { error: vi.fn() },
        findByID: vi.fn(async () => null),
      },
    };

    const res = await createStripeCustomer({
      operation: "create",
      req: req as any,
      data: { email: "user@example.com", name: "User", stripeCustomerId: "" } as any,
    } as any);

    expect(stripeCustomersCreateCalls.length).toBe(1);
    const [_createParams, createOpts] = stripeCustomersCreateCalls[0]!.args;
    expect(createOpts).toBeUndefined();
    expect(res.stripeCustomerId).toBe("cus_platform_1");
  });
});

