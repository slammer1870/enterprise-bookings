/**
 * Tests for subscription helpers: getRemainingSessionsInPeriod, hasReachedSubscriptionLimit.
 * Session limits and remaining-sessions logic used to filter plans on the booking page.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Payload } from "payload";
import {
  getRemainingSessionsInPeriod,
  getRemainingSessionsInPeriodForPlan,
  hasReachedSubscriptionLimit,
  subscriptionNeedsCustomerPortal,
  canUseSubscriptionForBooking,
  getSubscriptionUpgradeOptions,
  getMaxSubscriptionQuantityPerTimeslot,
} from "../src/subscription";
import type { Plan, Subscription, Timeslot } from "@repo/shared-types";

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

const yoga = 1;
const sauna = 2;
const float = 3;

function countsByEventTypeList(counts: Record<string, number>) {
  return vi.fn(async (args: { where?: Record<string, { in?: number[] }> }) => {
    const ids = args.where?.["timeslot.eventType"]?.in;
    const key = ids ? [...ids].sort((a, b) => a - b).join(",") : "*";
    return { totalDocs: counts[key] ?? 0, docs: [] };
  });
}

function countsBookingsInAskedWindow(
  bookings: Array<{ eventTypeId: number; startTime: Date }>,
) {
  return vi.fn(async (args: { where?: Record<string, unknown> }) => {
    const where = args.where ?? {};
    const ids = (where["timeslot.eventType"] as { in?: number[] } | undefined)?.in;
    const range = where["timeslot.startTime"] as
      | { greater_than_equal?: Date | string; less_than_equal?: Date | string }
      | undefined;
    const start = range?.greater_than_equal
      ? new Date(range.greater_than_equal).getTime()
      : Number.NEGATIVE_INFINITY;
    const end = range?.less_than_equal
      ? new Date(range.less_than_equal).getTime()
      : Number.POSITIVE_INFINITY;
    const totalDocs = bookings.filter((booking) => {
      if (ids && !ids.includes(booking.eventTypeId)) return false;
      const at = booking.startTime.getTime();
      return at >= start && at <= end;
    }).length;
    return { totalDocs, docs: [] };
  });
}

function planWithAllowances(opts: {
  id: number;
  name: string;
  sessions: number;
  allowedEventTypes: number[];
  interval?: "day" | "week" | "month" | "quarter" | "year";
  intervalCount?: number;
  maxBookingsPerTimeslot?: number | null;
  overrides?: Array<{
    eventType: number;
    sessions: number;
    interval?: "day" | "week" | "month" | "quarter" | "year";
    intervalCount?: number;
    maxBookingsPerTimeslot?: number | null;
  }>;
}): Plan {
  return {
    id: opts.id,
    name: opts.name,
    status: "active",
    allowedEventTypes: opts.allowedEventTypes,
    sessionsInformation: {
      sessions: opts.sessions,
      interval: opts.interval ?? "week",
      intervalCount: opts.intervalCount ?? 1,
      maxBookingsPerTimeslot: opts.maxBookingsPerTimeslot,
      eventTypeOverrides: opts.overrides,
    },
    updatedAt: "",
    createdAt: "",
  };
}

function timeslotFor(eventTypeId: number): Timeslot {
  return { id: 50, eventType: { id: eventTypeId } } as unknown as Timeslot;
}

function payloadWithMemberPlan(plan: Plan, confirmedBookings: number): Payload {
  return {
    collections: { plans: {}, subscriptions: {}, bookings: {} },
    logger: { info: vi.fn(), error: vi.fn() },
    find: vi.fn(async (args: { collection?: string }) => {
      if (args.collection === "plans") return { docs: [plan], totalDocs: 1 };
      if (args.collection === "subscriptions") return { docs: [{ id: 1, plan }], totalDocs: 1 };
      return { docs: [], totalDocs: confirmedBookings };
    }),
  } as unknown as Payload;
}

describe("event type allowance buckets", () => {
  const sharedPlusFloat = planWithAllowances({
    id: 10,
    name: "2 shared, 1 float",
    sessions: 2,
    allowedEventTypes: [yoga, sauna, float],
    overrides: [{ eventType: float, sessions: 1 }],
  });
  const sub = { ...subscriptionWithPlan, plan: sharedPlusFloat } as Subscription;

  it("keeps a float booking out of the shared pool", async () => {
    const payload = createMockPayload({
      find: countsByEventTypeList({
        "1,2": 0,
        "3": 1,
      }),
    });

    const yogaRemaining = await getRemainingSessionsInPeriodForPlan(
      sub,
      sharedPlusFloat,
      payload,
      lessonDate,
      yoga,
    );
    const floatRemaining = await getRemainingSessionsInPeriodForPlan(
      sub,
      sharedPlusFloat,
      payload,
      lessonDate,
      float,
    );

    expect(yogaRemaining).toBe(2);
    expect(floatRemaining).toBe(0);
  });

  it("lets yoga and sauna share 2 sessions a week when the plan has no overrides", async () => {
    const shared = planWithAllowances({
      id: 14,
      name: "2 per week",
      sessions: 2,
      allowedEventTypes: [yoga, sauna],
    });
    const sharedSub = { ...subscriptionWithPlan, plan: shared } as Subscription;
    const payload = createMockPayload({
      find: countsByEventTypeList({ "1,2": 1 }),
    });

    const yogaRemaining = await getRemainingSessionsInPeriodForPlan(
      sharedSub,
      shared,
      payload,
      lessonDate,
      yoga,
    );
    const saunaRemaining = await getRemainingSessionsInPeriodForPlan(
      sharedSub,
      shared,
      payload,
      lessonDate,
      sauna,
    );

    expect(yogaRemaining).toBe(1);
    expect(saunaRemaining).toBe(1);
  });

  it("counts a sauna row of 2 per week inside that week, so a sauna booking from the previous week leaves 2", async () => {
    const plan = planWithAllowances({
      id: 15,
      name: "8 per month, sauna 2 per week",
      sessions: 8,
      interval: "month",
      allowedEventTypes: [yoga, sauna],
      overrides: [{ eventType: sauna, sessions: 2, interval: "week", intervalCount: 1 }],
    });
    const member = { ...subscriptionWithPlan, plan } as Subscription;
    const payload = createMockPayload({
      find: countsBookingsInAskedWindow([
        { eventTypeId: sauna, startTime: new Date("2025-01-06T12:00:00Z") },
      ]),
    });

    const remaining = await getRemainingSessionsInPeriodForPlan(
      member,
      plan,
      payload,
      lessonDate,
      sauna,
    );

    expect(remaining).toBe(2);
  });

  it("counts a sauna row of 2 per week when Per is blank, so a sauna booking from the previous week leaves 2", async () => {
    const plan = planWithAllowances({
      id: 16,
      name: "8 per month, sauna 2 per week, Per blank",
      sessions: 8,
      interval: "month",
      allowedEventTypes: [yoga, sauna],
      overrides: [{ eventType: sauna, sessions: 2, interval: "week" }],
    });
    const member = { ...subscriptionWithPlan, plan } as Subscription;
    const payload = createMockPayload({
      find: countsBookingsInAskedWindow([
        { eventTypeId: sauna, startTime: new Date("2025-01-06T12:00:00Z") },
      ]),
    });

    const remaining = await getRemainingSessionsInPeriodForPlan(
      member,
      plan,
      payload,
      lessonDate,
      sauna,
    );

    expect(remaining).toBe(2);
  });

  it("blocks a third sauna and still allows yoga when each service has its own cap", async () => {
    const split = planWithAllowances({
      id: 11,
      name: "2 sauna, 1 yoga",
      sessions: 2,
      allowedEventTypes: [yoga, sauna],
      overrides: [
        { eventType: sauna, sessions: 2 },
        { eventType: yoga, sessions: 1 },
      ],
    });
    const splitSub = { ...subscriptionWithPlan, plan: split } as Subscription;
    const payload = createMockPayload({
      find: countsByEventTypeList({
        "2": 2,
        "1": 0,
      }),
    });

    await expect(
      hasReachedSubscriptionLimit(splitSub, payload, lessonDate, sauna),
    ).resolves.toBe(true);
    await expect(
      hasReachedSubscriptionLimit(splitSub, payload, lessonDate, yoga),
    ).resolves.toBe(false);
  });

  it("offers an upgrade only for the event type whose remaining allowance grew", async () => {
    const higherSharedSameFloat = planWithAllowances({
      id: 12,
      name: "3 shared, 1 float",
      sessions: 3,
      allowedEventTypes: [yoga, sauna, float],
      overrides: [{ eventType: float, sessions: 1 }],
    });
    const higherFloatSameShared = planWithAllowances({
      id: 13,
      name: "2 shared, 2 float",
      sessions: 2,
      allowedEventTypes: [yoga, sauna, float],
      overrides: [{ eventType: float, sessions: 2 }],
    });
    const payload = createMockPayload({
      find: countsByEventTypeList({}),
    });

    const floatUpgrades = await getSubscriptionUpgradeOptions(
      sub,
      [sharedPlusFloat, higherSharedSameFloat, higherFloatSameShared],
      payload,
      lessonDate,
      float,
    );
    const yogaUpgrades = await getSubscriptionUpgradeOptions(
      sub,
      [sharedPlusFloat, higherSharedSameFloat, higherFloatSameShared],
      payload,
      lessonDate,
      yoga,
    );

    expect(floatUpgrades.map((option) => option.plan.id)).toEqual([13]);
    expect(floatUpgrades[0]!.maxAdditionalSessions).toBe(1);
    expect(yogaUpgrades.map((option) => option.plan.id)).toEqual([12]);
    expect(yogaUpgrades[0]!.maxAdditionalSessions).toBe(1);
  });
});

describe("getMaxSubscriptionQuantityPerTimeslot event type caps", () => {
  const memberId = 100;

  it("uses the sauna row cap of 1 and leaves yoga on the plan cap of 4", async () => {
    const plan = planWithAllowances({
      id: 20,
      name: "4 per timeslot, sauna 1",
      sessions: 8,
      allowedEventTypes: [yoga, sauna],
      maxBookingsPerTimeslot: 4,
      overrides: [{ eventType: sauna, sessions: 2, maxBookingsPerTimeslot: 1 }],
    });

    const payload = payloadWithMemberPlan(plan, 0);
    const saunaSpots = await getMaxSubscriptionQuantityPerTimeslot(
      memberId,
      timeslotFor(sauna),
      payload,
    );
    const yogaSpots = await getMaxSubscriptionQuantityPerTimeslot(
      memberId,
      timeslotFor(yoga),
      payloadWithMemberPlan(plan, 0),
    );

    expect(saunaSpots).toBe(1);
    expect(yogaSpots).toBe(4);
    expect(payload.find).toHaveBeenCalledWith(
      expect.objectContaining({ collection: "plans", depth: 0 }),
    );
  });

  it("throws when the membership cap lookup fails so the booking is not created", async () => {
    const plan = planWithAllowances({
      id: 23,
      name: "cap lookup fails",
      sessions: 8,
      allowedEventTypes: [sauna],
      maxBookingsPerTimeslot: 1,
    });
    const payload = payloadWithMemberPlan(plan, 0);
    vi.mocked(payload.find).mockImplementation(async (args: { collection?: string }) => {
      if (args.collection === "plans") return { docs: [plan], totalDocs: 1 };
      if (args.collection === "subscriptions") return { docs: [{ id: 1, plan }], totalDocs: 1 };
      throw new Error("bookings unavailable");
    });

    await expect(
      getMaxSubscriptionQuantityPerTimeslot(memberId, timeslotFor(sauna), payload),
    ).rejects.toThrow("bookings unavailable");
  });

  it("keeps the plan cap when the sauna row leaves max bookings blank", async () => {
    const plan = planWithAllowances({
      id: 21,
      name: "1 per timeslot, sauna sessions only",
      sessions: 8,
      allowedEventTypes: [yoga, sauna],
      maxBookingsPerTimeslot: 1,
      overrides: [{ eventType: sauna, sessions: 2 }],
    });

    const spots = await getMaxSubscriptionQuantityPerTimeslot(
      memberId,
      timeslotFor(sauna),
      payloadWithMemberPlan(plan, 1),
    );

    expect(spots).toBe(0);
  });

  it("allows 3 float spots when the row cap is 3 and the plan cap is 1", async () => {
    const plan = planWithAllowances({
      id: 22,
      name: "1 per timeslot, float 3",
      sessions: 8,
      allowedEventTypes: [yoga, float],
      maxBookingsPerTimeslot: 1,
      overrides: [{ eventType: float, sessions: 4, maxBookingsPerTimeslot: 3 }],
    });

    const spots = await getMaxSubscriptionQuantityPerTimeslot(
      memberId,
      timeslotFor(float),
      payloadWithMemberPlan(plan, 0),
    );

    expect(spots).toBe(3);
  });
});
