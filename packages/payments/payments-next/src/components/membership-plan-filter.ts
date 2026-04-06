import type { Plan, Subscription } from "@repo/shared-types";

export function planAllowsMultipleBookingsPerLesson(plan: unknown): boolean {
  if (!plan || typeof plan !== "object") return false;
  const p = plan as {
    sessionsInformation?: {
      sessions?: number;
      allowMultipleBookingsPerLesson?: boolean;
    };
  };
  return p.sessionsInformation?.allowMultipleBookingsPerLesson === true;
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

export function getMembershipPlansForView(args: {
  allowedPlanDocs: Plan[];
  eligiblePlansForQuantity: Plan[] | null;
  quantity: number;
  subscription: Subscription | null;
}): Plan[] {
  const { allowedPlanDocs, eligiblePlansForQuantity, quantity, subscription } = args;

  const activeAllowedPlans = allowedPlanDocs.filter((plan) => plan.status === "active");
  let activePlans = activeAllowedPlans;

  if (quantity > 1 && Array.isArray(eligiblePlansForQuantity)) {
    activePlans = eligiblePlansForQuantity.filter((plan) => plan.status === "active");
  } else {
    activePlans = activePlans.filter((plan) => planCanCoverQuantity(plan, quantity));
  }

  if (quantity > 1) {
    activePlans = activePlans.filter((plan) => planAllowsMultipleBookingsPerLesson(plan));
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
