import { Payload, Where, CollectionSlug } from "payload";

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
        end_date: { greater_than: new Date() },
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
  subscription: any,
  plan: any,
  intervalStartDate: Date
): Where => {
  return {
    user: { equals: subscription.user.id },
    "lesson.classOption.paymentMethods.allowedPlans": {
      contains: plan.id,
    },
    createdAt: {
      greater_than: intervalStartDate,
    },
    status: { equals: "confirmed" },
  };
};

export const hasReachedSubscriptionLimit = async (
  subscription: any,
  payload: Payload
): Promise<boolean> => {
  let plan: any;

  if (typeof subscription.plan === "number") {
    plan = await payload.findByID({
      collection: "plans" as CollectionSlug,
      id: subscription.plan,
    });
  } else {
    plan = subscription.plan;
  }

  if (!plan.sessions) {
    return false;
  }

  const intervalStartDate = getIntervalStartDate(
    plan.interval,
    plan.intervalCount || 1,
    new Date()
  );

  // TODO: add a check to see if the subscription is a drop in or free
  // if it is, then we need to check the drop in limit
  // if it is not, then we need to check the sessions limit

  const bookings = await payload.find({
    collection: "bookings" as CollectionSlug,
    where: query(subscription, plan, intervalStartDate),
    depth: 5,
  });

  if (bookings.docs.length >= plan.sessions) {
    return true;
  }

  return false;
};

const getIntervalStartDate = (
  intervalType: "day" | "week" | "month" | "quarter" | "year",
  intervalCount: number,
  date: Date
): Date => {
  const startDate = new Date(date);

  switch (intervalType) {
    case "day":
      startDate.setDate(startDate.getDate() - intervalCount);
      break;
    case "week":
      startDate.setDate(startDate.getDate() - intervalCount * 7);
      break;
    case "month":
      startDate.setMonth(startDate.getMonth() - intervalCount);
      break;
    case "quarter":
      startDate.setMonth(startDate.getMonth() - intervalCount * 3);
      break;
    case "year":
      startDate.setFullYear(startDate.getFullYear() - intervalCount);
      break;
  }

  return startDate;
};
