import { Payload, Where, CollectionSlug } from "payload";

import { Lesson, Plan, Subscription, User } from "@repo/shared-types";
import { getIntervalStartAndEndDate } from "@repo/shared-utils";

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

  // Fast paths for fixed-length intervals.
  if (opts.intervalType === "day" || opts.intervalType === "week") {
    const msPerDay = 24 * 60 * 60 * 1000;
    const periodMs =
      opts.intervalType === "day"
        ? opts.intervalCount * msPerDay
        : opts.intervalCount * 7 * msPerDay;

    const diffMs = lessonDate.getTime() - subscriptionStart.getTime();
    const periodIndex = diffMs >= 0 ? Math.floor(diffMs / periodMs) : 0;

    const startDate = new Date(subscriptionStart.getTime() + periodIndex * periodMs);
    const endDate = new Date(startDate.getTime() + periodMs - 1);
    return { startDate, endDate };
  }

  // Month/quarter/year: align periods to subscriptionStartDate's day-of-month.
  const monthsPerPeriod =
    opts.intervalType === "month"
      ? opts.intervalCount
      : opts.intervalType === "quarter"
        ? opts.intervalCount * 3
        : opts.intervalCount * 12;

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

const query = (
  subscription: Subscription,
  plan: Plan,
  startDate: Date,
  endDate: Date
): Where => {
  const userId =
    typeof subscription.user === "object" && subscription.user !== null
      ? subscription.user.id
      : subscription.user;

  const planId = plan?.id;

  return {
    user: { equals: userId },
    "lesson.classOption.paymentMethods.allowedPlans": {
      contains: planId,
    },
    "lesson.startTime": {
      greater_than_equal: startDate,
      less_than_equal: endDate,
    },
    status: { equals: "confirmed" },
  };
};

export const hasReachedSubscriptionLimit = async (
  subscription: Subscription,
  payload: Payload,
  lessonDate: Date
): Promise<boolean> => {
  // Ensure plan is populated - if it's just an ID, fetch it
  let plan = subscription.plan as unknown as Plan | number;
  if (typeof plan === "number") {
    try {
      plan = (await payload.findByID({
        collection: "plans" as CollectionSlug,
        id: plan,
      })) as Plan;
    } catch {
      payload.logger.info("Plan not found");
      return false;
    }
  }

  if (
    !plan ||
    !plan.sessionsInformation ||
    !plan.sessionsInformation.sessions ||
    !plan.sessionsInformation.interval ||
    !plan.sessionsInformation.intervalCount
  ) {
    payload.logger.info("Plan does not have sessions information");
    return false;
  }

  // Prefer subscription-anchored periods (more predictable than calendar week/month boundaries)
  // but fall back to the legacy calendar-based behavior if subscription startDate is missing.
  const { startDate, endDate } = subscription.startDate
    ? getSubscriptionPeriodStartAndEndDate({
        subscriptionStartDate: subscription.startDate as any,
        lessonDate,
        intervalType: plan.sessionsInformation.interval,
        intervalCount: plan.sessionsInformation.intervalCount || 1,
      })
    : getIntervalStartAndEndDate(
        plan.sessionsInformation.interval,
        plan.sessionsInformation.intervalCount || 1,
        lessonDate
      );

  // TODO: add a check to see if the subscription is a drop in or free
  // if it is, then we need to check the drop in limit
  // if it is not, then we need to check the sessions limit

  try {
    const bookings = await payload.find({
      collection: "bookings" as CollectionSlug,
      depth: 5,
      where: query(subscription, plan as Plan, startDate, endDate),
    });

    payload.logger.info(
      `Bookings found for subscription (subscriptionId: ${subscription.id}, planId: ${(plan as Plan).id}, count: ${bookings.docs.length}, limit: ${plan.sessionsInformation.sessions})`
    );

    if (bookings.docs.length >= plan.sessionsInformation.sessions) {
      return true;
    }
  } catch (error) {
    console.error("Error finding bookings:", error);
    throw error;
  }

  return false;
};

// Helper function to check user subscription
export const checkUserSubscription = async (
  user: User,
  lesson: Lesson,
  payload: any
): Promise<boolean> => {
  const allowedPlans = lesson.classOption.paymentMethods?.allowedPlans;

  if (!allowedPlans || allowedPlans.length === 0) {
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
          in: allowedPlans.map((plan: any) =>
            typeof plan === "object" && plan !== null ? plan.id : plan
          ),
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
      payload.logger.error(`User does not have an active subscription (userId: ${user.id}, lessonId: ${lesson.id})`);
      return false;
    }

    const subscription = userSubscription.docs[0] as Subscription & {
      plan: Plan;
    };

    if (
      (subscription.cancelAt &&
        new Date(subscription.cancelAt) <= new Date()) ||
      (subscription.cancelAt &&
        new Date(subscription.cancelAt) <= new Date(lesson.startTime))
    ) {
      payload.logger.error(
        `User has an active subscription that is cancelled by the date of this lesson (userId: ${user.id}, lessonId: ${lesson.id}, subscriptionId: ${subscription.id})`
      );
      return false;
    }

    const reachedLimit = await hasReachedSubscriptionLimit(
      subscription,
      payload,
      new Date(lesson.startTime)
    );
    if (reachedLimit) {
      payload.logger.error(`User has reached the subscription limit (userId: ${user.id}, lessonId: ${lesson.id}, subscriptionId: ${subscription.id})`);
      return false;
    }

    if (lesson.classOption.type === "child") {
      const plan = subscription.plan as Plan;

      if (!plan) return false;

      if (!plan.type || !["child", "family"].includes(plan.type)) return false;

      // First, get all children of the parent user
      const childrenQuery = await payload.find({
        collection: "users",
        where: {
          parent: { equals: user.id },
        },
        depth: 1,
      });

      const childrenIds = childrenQuery.docs.map((child: any) => child.id);

      // Then query for bookings where the user is one of the children
      const bookings = await payload.find({
        collection: "bookings",
        where: {
          lesson: { equals: lesson.id },
          user: { in: childrenIds },
          status: { equals: "confirmed" },
        },
      });

      const quantity = plan.quantity || 1;

      if (bookings.totalDocs >= quantity) {
        payload.logger.error(`User has reached the child subscription limit (userId: ${user.id}, lessonId: ${lesson.id}, subscriptionId: ${subscription.id}, limit: ${quantity})`);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error("Error checking subscription:", error);
    return false;
  }
};

