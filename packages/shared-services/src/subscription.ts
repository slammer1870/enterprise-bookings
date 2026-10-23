import { Payload, Where, CollectionSlug } from "payload";

import { Timeslot, Plan, Subscription, User } from "@repo/shared-types";
import { getIntervalStartAndEndDate, getSessionLimitWindowStartAndEndDate } from "@repo/shared-utils";
import {
  additionalSessionsForUpgrade,
  maxBookingsPerTimeslotForEventType,
  membershipBucketForEventType,
  relationId,
  type AllowanceKind,
} from "./event-type-allowance";
import { findPlansForEventType } from "./product-allow-list";

/** Resolve plan collection slug (plans). */
function getPlanCollectionSlug(payload: Payload): CollectionSlug {
  return payload.collections && "plans" in payload.collections
    ? ("plans" as CollectionSlug)
    : ("plans" as CollectionSlug);
}

/**
 * Resolve per-user max confirmed bookings allowed for the same timeslot.
 * - `null`/`undefined` => unbounded (Infinity)
 * - any number < 1 => treated as 1
 */
function getPlanMaxBookingsPerTimeslot(plan: Plan, eventTypeId: number | null = null): number {
  const si = plan?.sessionsInformation as
    | (NonNullable<Plan["sessionsInformation"]> & {
        maxBookingsPerTimeslot?: number | null;
      })
    | null
    | undefined;

  const max = maxBookingsPerTimeslotForEventType(
    si?.eventTypeOverrides,
    eventTypeId,
    si?.maxBookingsPerTimeslot,
  );
  return max == null ? Infinity : Math.max(1, max);
}

function getSubscriptionPeriodStartAndEndDate(opts: {
  subscriptionStartDate: Date | string;
  lessonDate: Date;
  intervalType: "day" | "week" | "month" | "quarter" | "year";
  intervalCount: number;
}): { startDate: Date; endDate: Date } {
  const subscriptionStart =
    typeof opts.subscriptionStartDate === "string"
      ? new Date(opts.subscriptionStartDate)
      : new Date(opts.subscriptionStartDate);

  // Normalize subscription start to start-of-day to keep periods stable.
  subscriptionStart.setHours(0, 0, 0, 0);

  const lessonDate = new Date(opts.lessonDate);

  // For day/week/month we intentionally ignore `subscription.startDate` and
  // use the lesson-date anchored windows (calendar/rolling), matching the
  // "X per week/month" semantics users expect.
  if (opts.intervalType === "day" || opts.intervalType === "week" || opts.intervalType === "month") {
    return getSessionLimitWindowStartAndEndDate({
      intervalType: opts.intervalType,
      intervalCount: opts.intervalCount,
      lessonDate,
    });
  }

  // Month/quarter/year: align periods to subscriptionStartDate's day-of-month.
  const monthsPerPeriod = opts.intervalType === "quarter" ? opts.intervalCount * 3 : opts.intervalCount * 12;

  const monthsBetween =
    (lessonDate.getFullYear() - subscriptionStart.getFullYear()) * 12 +
    (lessonDate.getMonth() - subscriptionStart.getMonth());

  let periodIndex = monthsBetween >= 0 ? Math.floor(monthsBetween / monthsPerPeriod) : 0;

  const addMonths = (d: Date, months: number) => {
    const nd = new Date(d);
    nd.setMonth(nd.getMonth() + months);
    return nd;
  };

  // Adjust to ensure lessonDate is within [start, end]
  while (periodIndex > 0) {
    const startCandidate = addMonths(subscriptionStart, periodIndex * monthsPerPeriod);
    const nextCandidate = addMonths(startCandidate, monthsPerPeriod);
    if (lessonDate >= startCandidate && lessonDate < nextCandidate) break;
    if (lessonDate < startCandidate) periodIndex -= 1;
    else periodIndex += 1;
  }

  const startDate = addMonths(subscriptionStart, periodIndex * monthsPerPeriod);
  const endDate = new Date(addMonths(startDate, monthsPerPeriod).getTime() - 1);
  return { startDate, endDate };
}

export const hasActiveSubscription = async (
  userId: number,
  payload: Payload
): Promise<boolean> => {
  try {
    const userSubscription = await payload.find({
      collection: "subscriptions" as CollectionSlug,
      where: {
        user: { equals: userId },
        status: { equals: "active" },
        endDate: { greater_than: new Date() },
      },
      limit: 1,
      depth: 3,
    });

    return userSubscription.docs.length > 0;
  } catch (error) {
    console.error(error);
    return false;
  }
};

function subscriptionUserId(subscription: Subscription): number | null {
  const user = subscription.user;
  if (typeof user === "object" && user !== null) return relationId(user);
  return relationId(user);
}

function sessionWindow(
  subscription: Subscription,
  lessonDate: Date,
  intervalType: "day" | "week" | "month" | "quarter" | "year",
  intervalCount: number,
): { startDate: Date; endDate: Date } {
  if (intervalType === "day" || intervalType === "week" || intervalType === "month") {
    return getSessionLimitWindowStartAndEndDate({
      intervalType,
      intervalCount,
      lessonDate,
    });
  }
  return subscription.startDate
    ? getSubscriptionPeriodStartAndEndDate({
        subscriptionStartDate: subscription.startDate as Date | string,
        lessonDate,
        intervalType,
        intervalCount,
      })
    : getIntervalStartAndEndDate(intervalType, intervalCount, lessonDate);
}

async function countBookingsInWindow(
  payload: Payload,
  subscription: Subscription,
  startDate: Date,
  endDate: Date,
  eventTypeIds: number[] | null,
): Promise<number> {
  if (eventTypeIds != null && eventTypeIds.length === 0) return 0;
  const userId = subscriptionUserId(subscription);
  const where: Where = {
    user: { equals: userId },
    status: { equals: "confirmed" },
    "timeslot.startTime": {
      greater_than_equal: startDate,
      less_than_equal: endDate,
    },
  };
  if (eventTypeIds != null) {
    where["timeslot.eventType"] = { in: eventTypeIds };
  }
  const bookings = await payload.find({
    collection: "bookings" as CollectionSlug,
    depth: 0,
    where,
    limit: 0,
    overrideAccess: true,
  });
  return bookings.totalDocs ?? 0;
}

async function resolvePlanAllowance(
  subscription: Subscription,
  plan: Plan,
  payload: Payload,
  lessonDate: Date,
  eventTypeId: number | null,
): Promise<{ bucket: AllowanceKind; remaining: number | null }> {
  const bucket = membershipBucketForEventType(plan, eventTypeId);
  if (bucket.kind === "disallowed") return { bucket, remaining: 0 };
  if (bucket.kind === "unlimited") return { bucket, remaining: null };
  const { startDate, endDate } = sessionWindow(
    subscription,
    lessonDate,
    bucket.interval,
    bucket.intervalCount,
  );
  const used = await countBookingsInWindow(
    payload,
    subscription,
    startDate,
    endDate,
    bucket.eventTypeIds,
  );
  return { bucket, remaining: Math.max(0, bucket.limit - used) };
}

export const hasReachedSubscriptionLimit = async (
  subscription: Subscription,
  payload: Payload,
  lessonDate: Date,
  eventTypeId?: number | null,
): Promise<boolean> => {
  let plan = subscription.plan as unknown as Plan | number;
  if (typeof plan === "number") {
    try {
      plan = (await payload.findByID({
        collection: getPlanCollectionSlug(payload),
        id: plan,
      })) as Plan;
    } catch {
      payload.logger.info("Plan not found");
      return false;
    }
  }

  if (!plan) return false;

  try {
    const { bucket, remaining } = await resolvePlanAllowance(
      subscription,
      plan,
      payload,
      lessonDate,
      eventTypeId ?? null,
    );
    if (bucket.kind === "disallowed") return true;
    if (bucket.kind === "unlimited" || remaining == null) {
      payload.logger.info("Plan does not have sessions information");
      return false;
    }
    payload.logger.info(
      `Bookings found for subscription (subscriptionId: ${subscription.id}, planId: ${plan.id}, remaining: ${remaining}, limit: ${bucket.kind === "limited" ? bucket.limit : "unlimited"})`,
    );
    return remaining <= 0;
  } catch (error) {
    console.error("Error finding bookings:", error);
    throw error;
  }
};

/**
 * Returns remaining sessions in the current billing period for the subscription.
 * Returns null if the plan has no session limit (unlimited) or plan/session info is missing.
 * Used to filter which plans can be shown on the booking page based on selected quantity.
 */
export const getRemainingSessionsInPeriod = async (
  subscription: Subscription,
  payload: Payload,
  lessonDate: Date,
  eventTypeId?: number | null,
): Promise<number | null> => {
  let plan = subscription.plan as unknown as Plan | number;
  if (typeof plan === "number") {
    try {
      plan = (await payload.findByID({
        collection: getPlanCollectionSlug(payload),
        id: plan,
      })) as Plan;
    } catch {
      return null;
    }
  }

  return await getRemainingSessionsInPeriodForPlan(
    subscription,
    plan as Plan,
    payload,
    lessonDate,
    eventTypeId,
  );
};

/**
 * Returns remaining sessions in the current billing period for the given plan, using the subscription's period anchor.
 * Returns null if the plan has no session limit (unlimited) or plan/session info is missing.
 */
export const getRemainingSessionsInPeriodForPlan = async (
  subscription: Subscription,
  plan: Plan,
  payload: Payload,
  lessonDate: Date,
  eventTypeId?: number | null,
): Promise<number | null> => {
  if (!plan) return null;
  try {
    const { remaining } = await resolvePlanAllowance(
      subscription,
      plan,
      payload,
      lessonDate,
      eventTypeId ?? null,
    );
    return remaining;
  } catch {
    return null;
  }
};

/**
 * Returns the maximum additional booking quantity the user can create for this timeslot
 * when booking via subscription. Returns null if user has no subscription for this timeslot
 * (caller may allow any quantity if they are paying).
 * When allowMultipleBookingsPerTimeslot is false, max is 1 per timeslot.
 */
export const getMaxSubscriptionQuantityPerTimeslot = async (
  userId: number,
  timeslot: Timeslot,
  payload: Payload
): Promise<number | null> => {
  const eventTypeId = relationId(timeslot.eventType);
  const tenantId = relationId(timeslot.tenant);
  const allowedPlans = await findPlansForEventType(payload, eventTypeId, { tenantId });
  if (allowedPlans.length === 0) return null;

  try {
    const subs = await payload.find({
      collection: "subscriptions" as CollectionSlug,
      where: {
        user: { equals: userId },
        status: { equals: "active" },
        startDate: { less_than_equal: new Date() },
        endDate: { greater_than_equal: new Date() },
        plan: {
          in: allowedPlans.map((plan) => plan.id),
        },
        or: [
          { cancelAt: { greater_than: new Date() } },
          { cancelAt: { exists: false } },
        ],
      },
      depth: 2,
      limit: 1,
      overrideAccess: true,
    });

    if (subs.docs.length === 0) return null;

    let plan = (subs.docs[0] as Subscription).plan as Plan | number;
    if (typeof plan === "number") {
      plan = (await payload.findByID({
        collection: getPlanCollectionSlug(payload),
        id: plan,
        depth: 0,
      })) as Plan;
    }
    if (!plan) return null;

    const maxPerTimeslot = getPlanMaxBookingsPerTimeslot(plan, eventTypeId);

    const existing = await payload.find({
      collection: "bookings" as CollectionSlug,
      where: {
        timeslot: { equals: timeslot.id },
        user: { equals: userId },
        status: { equals: "confirmed" },
      },
      limit: 0,
      overrideAccess: true,
    });

    const existingCount = existing.totalDocs ?? 0;
    const maxAdditional = Math.max(0, maxPerTimeslot - existingCount);
    return maxAdditional;
  } catch (error) {
    payload.logger?.error?.(`getMaxSubscriptionQuantityPerTimeslot: ${error}`);
    return null;
  }
};

/** Statuses that allow using subscription for booking (no portal required). */
const USABLE_SUBSCRIPTION_STATUSES = ["active", "trialing"] as const;

/** Statuses that require the customer to visit the portal (e.g. update payment). */
export const NEEDS_PORTAL_SUBSCRIPTION_STATUSES = ["past_due", "unpaid"] as const;

export function subscriptionNeedsCustomerPortal(
  status: string | undefined
): boolean {
  return status != null && (NEEDS_PORTAL_SUBSCRIPTION_STATUSES as readonly string[]).includes(status);
}

export function canUseSubscriptionForBooking(status: string | undefined): boolean {
  return status != null && (USABLE_SUBSCRIPTION_STATUSES as readonly string[]).includes(status);
}

export type SubscriptionUpgradeOption = {
  plan: Plan;
  /** Null means the target plan does not cap this event type. */
  maxAdditionalSessions: number | null;
};

/**
 * For a user with a current subscription and session limit reached (or nearly),
 * returns allowed plans they can upgrade to with pro-rata additional sessions.
 * E.g. 2/week plan, used 2 this week, upgrade to 3/week → 1 more session (not 3).
 */
export const getSubscriptionUpgradeOptions = async (
  subscription: Subscription,
  allowedPlans: Plan[],
  payload: Payload,
  lessonDate: Date,
  eventTypeId?: number | null,
): Promise<SubscriptionUpgradeOption[]> => {
  let currentPlan = subscription.plan as Plan | number;
  if (typeof currentPlan === "number") {
    try {
      currentPlan = (await payload.findByID({
        collection: getPlanCollectionSlug(payload),
        id: currentPlan,
        depth: 0,
      })) as Plan;
    } catch {
      return [];
    }
  }
  if (!currentPlan) return [];

  let currentAllowance: { bucket: AllowanceKind; remaining: number | null };
  try {
    currentAllowance = await resolvePlanAllowance(
      subscription,
      currentPlan,
      payload,
      lessonDate,
      eventTypeId ?? null,
    );
  } catch {
    return [];
  }
  if (currentAllowance.bucket.kind === "unlimited") return [];

  const options: SubscriptionUpgradeOption[] = [];
  for (const targetPlan of allowedPlans) {
    if (targetPlan.id === currentPlan.id) continue;
    let targetAllowance: { bucket: AllowanceKind; remaining: number | null };
    try {
      targetAllowance = await resolvePlanAllowance(
        subscription,
        targetPlan,
        payload,
        lessonDate,
        eventTypeId ?? null,
      );
    } catch {
      continue;
    }
    const additional = additionalSessionsForUpgrade(
      currentAllowance.bucket,
      currentAllowance.remaining,
      targetAllowance.bucket,
      targetAllowance.remaining,
    );
    if (additional == null) continue;
    options.push({
      plan: targetPlan,
      maxAdditionalSessions: additional === "unlimited" ? null : additional,
    });
  }

  return options;
};

// Helper function to check user subscription
export const checkUserSubscription = async (
  user: User,
  timeslot: Timeslot,
  payload: any
): Promise<boolean> => {
  const eventTypeId = relationId(timeslot.eventType);
  const tenantId = relationId((timeslot as { tenant?: unknown }).tenant);
  const allowedPlans = await findPlansForEventType(payload, eventTypeId, { tenantId });

  if (allowedPlans.length === 0) {
    return true;
  }

  try {
    const userSubscription = await payload.find({
      collection: "subscriptions" as CollectionSlug,
      where: {
        user: { equals: user.id },
        status: { equals: "active" },
        startDate: { less_than_equal: new Date() },
        endDate: { greater_than_equal: new Date() },
        plan: {
          in: allowedPlans.map((plan) => plan.id),
        },
        or: [
          { cancelAt: { greater_than: new Date() } },
          { cancelAt: { exists: false } },
        ],
      },
      depth: 2,
      limit: 1,
    });

    if (userSubscription.docs.length === 0) {
      payload.logger.error(`User does not have an active subscription (userId: ${user.id}, timeslotId: ${timeslot.id})`);
      return false;
    }

    const subscription = userSubscription.docs[0] as Subscription & {
      plan: Plan;
    };

    if (
      (subscription.cancelAt &&
        new Date(subscription.cancelAt) <= new Date()) ||
      (subscription.cancelAt &&
        new Date(subscription.cancelAt) <= new Date(timeslot.startTime))
    ) {
      payload.logger.error(
        `User has an active subscription that is cancelled by the date of this timeslot (userId: ${user.id}, timeslotId: ${timeslot.id}, subscriptionId: ${subscription.id})`
      );
      return false;
    }

    const reachedLimit = await hasReachedSubscriptionLimit(
      subscription,
      payload,
      new Date(timeslot.startTime),
      eventTypeId,
    );
    if (reachedLimit) {
      payload.logger.error(`User has reached the subscription limit (userId: ${user.id}, timeslotId: ${timeslot.id}, subscriptionId: ${subscription.id})`);
      return false;
    }

    if (timeslot.eventType.type === "child") {
      const plan = subscription.plan as Plan;

      if (!plan) return false;

      if (!plan.type || !["child", "family"].includes(plan.type)) return false;

      // First, get all children of the parent user
      const childrenQuery = await payload.find({
        collection: "users",
        where: {
          parentUser: { equals: user.id },
        },
        depth: 1,
      });

      const childrenIds = childrenQuery.docs.map((child: any) => child.id);

      // Then query for bookings where the user is one of the children
      const bookings = await payload.find({
        collection: "bookings",
        where: {
          timeslot: { equals: timeslot.id },
          user: { in: childrenIds },
          status: { equals: "confirmed" },
        },
      });

      const quantity = plan.quantity || 1;

      if (bookings.totalDocs >= quantity) {
        payload.logger.error(`User has reached the child subscription limit (userId: ${user.id}, timeslotId: ${timeslot.id}, subscriptionId: ${subscription.id}, limit: ${quantity})`);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error("Error checking subscription:", error);
    return false;
  }
};

