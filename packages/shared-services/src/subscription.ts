import { Payload, Where, CollectionSlug } from "payload";

import { Lesson, Plan, Subscription, User } from "@repo/shared-types";

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
  return {
    user: { equals: subscription.user.id },
    "lesson.classOption.paymentMethods.allowedPlans": {
      contains: plan.id,
    },
    "lesson.startTime": {
      greater_than: startDate,
      less_than: endDate,
    },
    status: { equals: "confirmed" },
  };
};

export const hasReachedSubscriptionLimit = async (
  subscription: Subscription,
  payload: Payload,
  lessonDate: Date
): Promise<boolean> => {
  const plan = subscription.plan;

  if (!plan.sessions || !plan.interval || !plan.intervalCount) {
    return false;
  }

  const { startDate, endDate } = getIntervalStartAndEndDate(
    plan.interval,
    plan.intervalCount || 1,
    lessonDate
  );

  // TODO: add a check to see if the subscription is a drop in or free
  // if it is, then we need to check the drop in limit
  // if it is not, then we need to check the sessions limit

  try {
    const bookings = await payload.find({
      collection: "bookings" as CollectionSlug,
      depth: 5,
      where: query(subscription, plan, startDate, endDate),
    });

    if (bookings.docs.length >= plan.sessions) {
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
  try {
    const userSubscription = await payload.find({
      collection: "subscriptions" as CollectionSlug,
      where: {
        and: [
          {
            user: { equals: user.id },
            status: { equals: "active" },
          },
          {
            or: [
              { cancelAt: { greater_than: new Date() } },
              { cancelAt: { exists: false } },
              { cancelAt: { equals: null } },
            ],
          },
        ],
      },
      depth: 2,
      limit: 1,
    });

    if (userSubscription.docs.length === 0) return false;

    const subscription = userSubscription.docs[0] as Subscription & {
      plan: Plan;
    };

    if (
      !lesson.classOption.paymentMethods?.allowedPlans?.some(
        (plan) => plan.id == subscription.plan.id
      )
    ) {
      return false;
    }

    if (
      (subscription.cancelAt &&
        new Date(subscription.cancelAt) <= new Date()) ||
      (subscription.cancelAt &&
        new Date(subscription.cancelAt) <= new Date(lesson.startTime))
    ) {
      return false;
    }

    const reachedLimit = await hasReachedSubscriptionLimit(
      subscription,
      payload,
      new Date(lesson.startTime)
    );
    if (reachedLimit) return false;

    return true;
  } catch (error) {
    console.error("Error checking subscription:", error);
    return false;
  }
};

function getFirstHourOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(1, 0, 0, 0);
  return result;
}

function getLastHourOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

function getFirstDayOfWeek(date: Date): Date {
  const result = new Date(date);
  const day = result.getDay();
  const daysToSubtract = day === 0 ? 6 : day - 1;

  result.setDate(result.getDate() - daysToSubtract);
  result.setHours(1, 0, 0, 0); // Changed from 0 to 1 for 1:00 AM

  return result;
}

function getLastDayOfWeek(date: Date): Date {
  const result = getFirstDayOfWeek(date);
  result.setDate(result.getDate() + 6); // Add 6 days to get to Sunday
  result.setHours(23, 59, 59, 999);
  return result;
}

function getFirstDayOfMonth(date: Date): Date {
  const result = new Date(date);
  result.setDate(1);
  result.setHours(1, 0, 0, 0);
  return result;
}

function getLastDayOfMonth(date: Date): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + 1, 0); // Setting day to 0 of next month gives us last day of current month
  result.setHours(23, 59, 59, 999);
  return result;
}

function getFirstDayOfYear(date: Date): Date {
  const result = new Date(date);
  result.setMonth(0, 1);
  result.setHours(1, 0, 0, 0);
  return result;
}

function getLastDayOfYear(date: Date): Date {
  const result = new Date(date);
  result.setMonth(11, 31); // December 31st
  result.setHours(23, 59, 59, 999);
  return result;
}

const getIntervalStartAndEndDate = (
  intervalType: "day" | "week" | "month" | "quarter" | "year",
  intervalCount: number,
  lessonDate: Date
): { startDate: Date; endDate: Date } => {
  const currentDate = new Date(lessonDate);
  let startDate: Date;
  let endDate: Date;

  switch (intervalType) {
    case "day":
      endDate = getLastHourOfDay(currentDate);
      startDate = getFirstHourOfDay(new Date(currentDate));
      startDate.setDate(startDate.getDate() - (intervalCount - 1));
      break;
    case "week":
      endDate = getLastDayOfWeek(currentDate);
      startDate = getFirstDayOfWeek(new Date(currentDate));
      startDate.setDate(startDate.getDate() - 7 * (intervalCount - 1));
      break;
    case "month":
      endDate = getLastDayOfMonth(currentDate);
      startDate = getFirstDayOfMonth(new Date(currentDate));
      startDate.setMonth(startDate.getMonth() - (intervalCount - 1));
      break;
    case "quarter":
      endDate = getLastDayOfMonth(currentDate);
      startDate = getFirstDayOfMonth(new Date(currentDate));
      startDate.setMonth(startDate.getMonth() - 3 * (intervalCount - 1));
      break;
    case "year":
      endDate = getLastDayOfYear(currentDate);
      startDate = getFirstDayOfYear(new Date(currentDate));
      startDate.setFullYear(startDate.getFullYear() - (intervalCount - 1));
      break;
  }

  return { startDate, endDate };
};
