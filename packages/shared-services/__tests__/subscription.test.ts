/**
 * Tests for subscription helpers: getRemainingSessionsInPeriod, hasReachedSubscriptionLimit.
 * Session limits and remaining-sessions logic used to filter plans on the booking page.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Payload } from "payload";
import {
  getRemainingSessionsInPeriod,
  hasReachedSubscriptionLimit,
  subscriptionNeedsCustomerPortal,
  canUseSubscriptionForBooking,
  getSubscriptionUpgradeOptions,
} from "../src/subscription";
import type { Plan, Subscription } from "@repo/shared-types";

function createMockPayload(opts: {
  findByID?: (_args: unknown) => Promise<unknown>;
  find?: (_args: unknown) => Promise<{ totalDocs: number }>;
}) {
  return {
    find: opts.find ?? vi.fn().mockResolvedValue({ totalDocs: 0 }),
    findByID: opts.findByID ?? vi.fn(),
    collections: { plans: {} },
    logger: { info: vi.fn(), error: vi.fn() },
  } as unknown as Payload;
}

const planWithLimit: Plan = {
  id: 1,
  name: "Test Plan",
  status: "active",
  sessionsInformation: {
    sessions: 10,
    interval: "month",
    intervalCount: 1,
  },
  updatedAt: "",
  createdAt: "",
};

const subscriptionWithPlan: Subscription = {
  id: 1,
  user: 100,
  plan: planWithLimit,
  status: "active",
  startDate: new Date("2025-01-01T00:00:00Z"),
  endDate: new Date("2025-12-31T23:59:59Z"),
  stripeSubscriptionId: "sub_xxx",
  stripeCustomerId: "cus_xxx",
  updatedAt: "",
  createdAt: "",
} as Subscription;

const lessonDate = new Date("2025-01-15T12:00:00Z");

describe("getRemainingSessionsInPeriod", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when plan has no sessionsInformation (unlimited)", async () => {
    const planUnlimited = { ...planWithLimit, sessionsInformation: undefined };
    const sub = { ...subscriptionWithPlan, plan: planUnlimited };
    const payload = createMockPayload({});

    const result = await getRemainingSessionsInPeriod(
      sub as Subscription,
      payload,
      lessonDate
    );

    expect(result).toBeNull();
    expect(payload.find).not.toHaveBeenCalled();
  });

  it("returns null when plan has sessions <= 0", async () => {
    const planNoSessions = {
      ...planWithLimit,
      sessionsInformation: {
        sessions: 0,
        interval: "month",
        intervalCount: 1,
      },
    };
    const sub = { ...subscriptionWithPlan, plan: planNoSessions };
    const payload = createMockPayload({});

    const result = await getRemainingSessionsInPeriod(
      sub as Subscription,
      payload,
      lessonDate
    );

    expect(result).toBeNull();
  });

  it("returns remaining sessions when plan has limit and some bookings used", async () => {
    const payload = createMockPayload({
      find: vi.fn().mockResolvedValue({ totalDocs: 3 }),
    });

    const result = await getRemainingSessionsInPeriod(
      subscriptionWithPlan as Subscription,
      payload,
      lessonDate
    );

    expect(result).toBe(7); // 10 - 3
    expect(payload.find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "bookings",
        limit: 0,
      })
    );
  });

  it("returns 0 when used >= limit", async () => {
    const payload = createMockPayload({
      find: vi.fn().mockResolvedValue({ totalDocs: 10 }),
    });

    const result = await getRemainingSessionsInPeriod(
      subscriptionWithPlan as Subscription,
      payload,
      lessonDate
    );

    expect(result).toBe(0);
  });

  it("returns limit when no bookings used", async () => {
    const payload = createMockPayload({
      find: vi.fn().mockResolvedValue({ totalDocs: 0 }),
    });

    const result = await getRemainingSessionsInPeriod(
      subscriptionWithPlan as Subscription,
      payload,
      lessonDate
    );

    expect(result).toBe(10);
  });

  it("resolves plan by id when subscription.plan is number", async () => {
    const payload = createMockPayload({
      findByID: vi.fn().mockResolvedValue(planWithLimit),
      find: vi.fn().mockResolvedValue({ totalDocs: 2 }),
    });

    const subWithPlanId = { ...subscriptionWithPlan, plan: 1 };
    const result = await getRemainingSessionsInPeriod(
      subWithPlanId as Subscription,
      payload,
      lessonDate
    );

    expect(result).toBe(8);
    expect(payload.findByID).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "plans",
        id: 1,
      })
    );
  });

  it("returns null when payload.find throws", async () => {
    const payload = createMockPayload({
      find: vi.fn().mockRejectedValue(new Error("DB error")),
    });

    const result = await getRemainingSessionsInPeriod(
      subscriptionWithPlan as Subscription,
      payload,
      lessonDate
    );

    expect(result).toBeNull();
  });
});

describe("hasReachedSubscriptionLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when bookings count >= plan sessions", async () => {
    const payload = createMockPayload({
      find: vi.fn().mockResolvedValue({
        docs: Array(10).fill({}),
        totalDocs: 10,
      }),
    });

    const result = await hasReachedSubscriptionLimit(
      subscriptionWithPlan as Subscription,
      payload,
      lessonDate
    );

    expect(result).toBe(true);
  });

  it("returns false when bookings count < plan sessions", async () => {
    const payload = createMockPayload({
      find: vi.fn().mockResolvedValue({
        docs: Array(3).fill({}),
        totalDocs: 3,
      }),
    });

    const result = await hasReachedSubscriptionLimit(
      subscriptionWithPlan as Subscription,
      payload,
      lessonDate
    );

    expect(result).toBe(false);
  });

  it("returns false when plan has no sessionsInformation", async () => {
    const planUnlimited = { ...planWithLimit, sessionsInformation: undefined };
    const sub = { ...subscriptionWithPlan, plan: planUnlimited };
    const payload = createMockPayload({});

    const result = await hasReachedSubscriptionLimit(
      sub as Subscription,
      payload,
      lessonDate
    );

    expect(result).toBe(false);
    expect(payload.find).not.toHaveBeenCalled();
  });
});

describe("subscriptionNeedsCustomerPortal", () => {
  it("returns true for past_due and unpaid", () => {
    expect(subscriptionNeedsCustomerPortal("past_due")).toBe(true);
    expect(subscriptionNeedsCustomerPortal("unpaid")).toBe(true);
  });

  it("returns false for active and trialing", () => {
    expect(subscriptionNeedsCustomerPortal("active")).toBe(false);
    expect(subscriptionNeedsCustomerPortal("trialing")).toBe(false);
  });

  it("returns false for undefined or other statuses", () => {
    expect(subscriptionNeedsCustomerPortal(undefined)).toBe(false);
    expect(subscriptionNeedsCustomerPortal("canceled")).toBe(false);
  });
});

describe("canUseSubscriptionForBooking", () => {
  it("returns true for active and trialing", () => {
    expect(canUseSubscriptionForBooking("active")).toBe(true);
    expect(canUseSubscriptionForBooking("trialing")).toBe(true);
  });

  it("returns false for past_due and unpaid", () => {
    expect(canUseSubscriptionForBooking("past_due")).toBe(false);
    expect(canUseSubscriptionForBooking("unpaid")).toBe(false);
  });

  it("returns false for undefined or other statuses", () => {
    expect(canUseSubscriptionForBooking(undefined)).toBe(false);
    expect(canUseSubscriptionForBooking("canceled")).toBe(false);
  });
});

describe("getSubscriptionUpgradeOptions", () => {
  const plan2PerWeek: Plan = {
    id: 1,
    name: "2/week",
    status: "active",
    sessionsInformation: {
      sessions: 2,
      interval: "week",
      intervalCount: 1,
    },
    updatedAt: "",
    createdAt: "",
  };

  const plan3PerWeek: Plan = {
    id: 2,
    name: "3/week",
    status: "active",
    sessionsInformation: {
      sessions: 3,
      interval: "week",
      intervalCount: 1,
    },
    updatedAt: "",
    createdAt: "",
  };

  const sub2PerWeek: Subscription = {
    ...subscriptionWithPlan,
    plan: plan2PerWeek,
  } as Subscription;

  it("returns empty when no allowed plans with more sessions", async () => {
    const payload = createMockPayload({});
    const result = await getSubscriptionUpgradeOptions(
      sub2PerWeek,
      [plan2PerWeek],
      payload,
      lessonDate
    );
    expect(result).toEqual([]);
  });

  it("returns upgrade option with pro-rata max additional sessions (2/week used 2, upgrade to 3/week = 1 more)", async () => {
    const payload = createMockPayload({
      find: vi.fn().mockResolvedValue({ totalDocs: 2 }),
    });
    const result = await getSubscriptionUpgradeOptions(
      sub2PerWeek,
      [plan2PerWeek, plan3PerWeek],
      payload,
      lessonDate
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.plan.id).toBe(2);
    expect(result[0]!.maxAdditionalSessions).toBe(1);
  });

  it("returns upgrade option when used 0 (pro-rata cap: 1 more)", async () => {
    const payload = createMockPayload({
      find: vi.fn().mockResolvedValue({ totalDocs: 0 }),
    });
    const result = await getSubscriptionUpgradeOptions(
      sub2PerWeek,
      [plan2PerWeek, plan3PerWeek],
      payload,
      lessonDate
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.maxAdditionalSessions).toBe(1);
  });
});
