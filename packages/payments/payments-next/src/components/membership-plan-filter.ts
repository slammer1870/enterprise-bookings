import type { Plan, Subscription } from "@repo/shared-types";

export function planAllowsMultipleBookingsPerTimeslot(plan: unknown): boolean {
  // Legacy alias kept for backwards compatibility with older callers.
  // With numeric caps, "multiple" means "quantity > 1 is allowed".
  return planCanCoverQuantity(plan, 2) && planMaxAllowsQuantity(plan, 2);
}

export function planCanCoverQuantity(plan: unknown, requiredQuantity: number): boolean {
  if (requiredQuantity <= 0) return true;
  if (!plan || typeof plan !== "object") return false;
  const p = plan as {
    sessionsInformation?: {
      sessions?: number;
    };
  };
  const si = p.sessionsInformation;
  if (!si || si.sessions == null || si.sessions <= 0) return true;
  return si.sessions >= requiredQuantity;
}

export function planMaxAllowsQuantity(plan: unknown, requiredQuantity: number): boolean {
  if (requiredQuantity <= 0) return true;
  if (!plan || typeof plan !== "object") return false;

  const p = plan as {
    sessionsInformation?: {
      maxBookingsPerTimeslot?: number | null;
      allowMultipleBookingsPerTimeslot?: boolean;
    };
  };

  const rawMax = p.sessionsInformation?.maxBookingsPerTimeslot;
  const max =
    rawMax == null
      ? p.sessionsInformation?.allowMultipleBookingsPerTimeslot === true
        ? Infinity
        : 1
      : Math.max(1, Number(rawMax));
  return requiredQuantity <= max;
}

export function getMembershipPlansForView(args: {
  allowedPlanDocs: Plan[];
  eligiblePlansForQuantity: Plan[] | null;
  quantity: number;
  subscription: Subscription | null;
}): Plan[] {
  const { allowedPlanDocs, eligiblePlansForQuantity, quantity, subscription } = args;

  const activeAllowedPlans = allowedPlanDocs.filter((plan) => plan.status === "active");
  let activePlans = activeAllowedPlans;

  // The server returns a non-null eligiblePlansForQuantity whenever the
  // effective total (confirmed + pending) > 1.  Trust that list over the
  // client-side quantity guard so that the manage-booking flow (where
  // confirmed > 0 but pending = 1) is also filtered correctly.
  if (Array.isArray(eligiblePlansForQuantity)) {
    activePlans = eligiblePlansForQuantity.filter((plan) => plan.status === "active");
  } else {
    activePlans = activePlans.filter((plan) => planCanCoverQuantity(plan, quantity));
  }

  if (quantity > 1) {
    activePlans = activePlans.filter((plan) => planMaxAllowsQuantity(plan, quantity));
  }

  const currentSubscriptionPlan =
    subscription?.plan && typeof subscription.plan === "object" && subscription.plan != null
      ? (subscription.plan as Plan)
      : null;
  const subscriptionPlanIsAllowed =
    currentSubscriptionPlan != null &&
    allowedPlanDocs.some((plan) => plan.id === currentSubscriptionPlan.id);

  return subscriptionPlanIsAllowed && currentSubscriptionPlan?.status !== "active"
    ? [currentSubscriptionPlan, ...activePlans]
    : activePlans;
}
