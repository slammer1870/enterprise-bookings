import { beforeEach, describe, expect, it, vi } from "vitest";

let retrieveCalls: any[] = [];

vi.mock("@repo/shared-utils", () => {
  const stripe = {
    customers: {
      retrieve: vi.fn(async (...args: any[]) => {
        // (customerId, opts?)
        retrieveCalls.push(args);
        return { id: args[0], email: "hook@example.com", deleted: false };
      }),
    },
  };
  return {
    stripe,
  };
});

function makePayload() {
  const users: any[] = [
    { id: 1, email: "hook@example.com", stripeCustomerId: "", stripeCustomers: [] },
  ];
  const subs: any[] = [{ id: 99, stripeSubscriptionId: "sub_1", user: 1, plan: 123 }];

  const payload = {
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
    find: vi.fn(async ({ collection, where, limit }: any) => {
      if (collection === "users") {
        if (where?.stripeCustomerId?.equals) {
          const docs = users.filter((u) => u.stripeCustomerId === where.stripeCustomerId.equals);
          return { docs: docs.slice(0, limit ?? 100), totalDocs: docs.length };
        }
        if (where?.email?.equals) {
          const docs = users.filter((u) => u.email === where.email.equals);
          return { docs: docs.slice(0, limit ?? 100), totalDocs: docs.length };
        }
        return { docs: [], totalDocs: 0 };
      }
      if (collection === "subscriptions") {
        if (where?.stripeSubscriptionId?.equals) {
          const docs = subs.filter((s) => s.stripeSubscriptionId === where.stripeSubscriptionId.equals);
          return { docs: docs.slice(0, limit ?? 100), totalDocs: docs.length };
        }
        return { docs: [], totalDocs: 0 };
      }
      if (collection === "plans") {
        return { docs: [{ id: 123 }], totalDocs: 1 };
      }
      return { docs: [], totalDocs: 0 };
    }),
    update: vi.fn(async ({ collection, id, data }: any) => {
      if (collection === "users") {
        const u = users.find((x) => x.id === id);
        if (u) Object.assign(u, data);
        return u;
      }
      if (collection === "subscriptions") {
        const s = subs.find((x) => x.id === id);
        if (s) Object.assign(s, data);
        return s;
      }
      return null;
    }),
  };

  return { payload, users };
}

beforeEach(() => {
  retrieveCalls = [];
  vi.clearAllMocks();
});

describe("Membership webhooks are Connect-aware", () => {
  it("subscriptionUpdated uses event.account when resolving customer email", async () => {
    const { subscriptionUpdated } = await import("../src/membership/webhooks/subscription-updated");
    const { payload, users } = makePayload();

    await subscriptionUpdated({
      payload: payload as any,
      // minimal Stripe event shape
      event: {
        account: "acct_connected_1",
        data: {
          object: {
            id: "sub_1",
            customer: "cus_connected_1",
            status: "active",
            items: { data: [{ plan: { product: "prod_1" } }] },
            metadata: {},
          },
        },
      } as any,
    } as any);

    expect(retrieveCalls.length).toBe(1);
    expect(retrieveCalls[0]?.[1]).toEqual({ stripeAccount: "acct_connected_1" });

    // Should store mapping in stripeCustomers instead of stripeCustomerId
    const u = users[0];
    expect(u.stripeCustomerId).toBe("");
    expect(u.stripeCustomers).toEqual([
      { stripeAccountId: "acct_connected_1", stripeCustomerId: "cus_connected_1" },
    ]);
  });
});

