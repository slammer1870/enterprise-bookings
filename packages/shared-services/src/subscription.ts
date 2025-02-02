import { Payload } from "payload";

export const hasActiveSubscription = async (
  userId: number,
  payload: Payload
): Promise<boolean> => {
  try {
    const userSubscription = await payload.find({
      collection: "subscriptions",
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

/*
const hasReachedSubscriptionLimit = async (
  subscription: Subscription & { user: User },
  payload: Payload
): Promise<boolean> => {
  let plan: Plan;

  if (typeof subscription.plan === "number") {
    plan = await payload.findByID({
      collection: "plans",
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
    plan.interval_count || 1,
    new Date()
  );

  const bookings = await payload.find({
    collection: "bookings",
    where: {
      user: { equals: subscription.user.id },
      createdAt: {
        greater_than: intervalStartDate,
      },
      status: { equals: "confirmed" },
    },
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
*/
