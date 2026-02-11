"use client";

import { Plan, Subscription } from "@repo/shared-types";
import { PlanList } from "./plans/plan-list";
import { PlanDetail } from "./plans/plan-detail";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@repo/ui/components/ui/card";

type PlanViewProps = {
  allowedPlans: Plan[] | undefined;
  subscription: Subscription | null;
  lessonDate: Date;
  subscriptionLimitReached: boolean;
  /** Remaining sessions in current period (null = unlimited). */
  remainingSessions?: number | null;
  /** Number of bookings selected on the page. */
  selectedQuantity?: number;
  /** When false, user cannot use subscription for current selection. */
  canUseSubscriptionForQuantity?: boolean;
  onCreateCheckoutSession: (
    _planId: string,
    _metadata?: { [key: string]: string | undefined }
  ) => Promise<void>;
  onCreateCustomerPortal: () => Promise<void>;
  onCreateCustomerUpgradePortal?: (_productId: string) => Promise<void>;
};

/**
 * PlanView component that accepts callbacks for checkout actions.
 * This version uses tRPC procedures instead of server actions.
 */
export function PlanView({
  allowedPlans,
  subscription,
  lessonDate,
  subscriptionLimitReached,
  remainingSessions = null,
  selectedQuantity: _selectedQuantity = 1,
  canUseSubscriptionForQuantity = true,
  onCreateCheckoutSession,
  onCreateCustomerPortal,
  onCreateCustomerUpgradePortal,
}: PlanViewProps) {
  if (!allowedPlans) {
    return (
      <p className="text-sm text-muted-foreground">
        No plans are available for this lesson
      </p>
    );
  }

  if (!subscription) {
    return (
      <PlanList
        plans={allowedPlans}
        actionLabel="Subscribe"
        onAction={onCreateCheckoutSession}
      />
    );
  }

  const hasMatchingPlan = allowedPlans.some(
    (plan) => plan.id === subscription.plan.id
  );

  if (!hasMatchingPlan) {
    const upgradeablePlans = allowedPlans.filter(
      (plan) => (plan as any).stripeProductId && plan.id !== subscription.plan.id
    );

    return (
      <>
        <p className="text-sm text-red-500 mb-2">
          You do not have a plan that allows you to book into this lesson, please
          upgrade your plan to continue
        </p>
        {onCreateCustomerUpgradePortal && upgradeablePlans.length > 0 ? (
          <div className="flex flex-col gap-4">
            {upgradeablePlans.map((plan) => (
              <Card key={plan.id}>
                <CardHeader>
                  <CardTitle className="font-light">{plan.name}</CardTitle>
                </CardHeader>
                <CardContent />
                <CardFooter>
                  <Button
                    className="w-full"
                    onClick={() =>
                      onCreateCustomerUpgradePortal((plan as any).stripeProductId as string)
                    }
                  >
                    Upgrade Subscription
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <PlanList
            plans={allowedPlans.filter((plan) => plan.id !== subscription.plan.id)}
            actionLabel="Upgrade"
            onAction={onCreateCheckoutSession}
          />
        )}
      </>
    );
  }

  const notEnoughSessionsLeft =
    !canUseSubscriptionForQuantity &&
    remainingSessions != null &&
    remainingSessions > 0;

  return (
    <>
      {subscriptionLimitReached && (
        <p className="text-sm text-red-500 mb-2">
          You have reached the limit of your subscription
        </p>
      )}
      {notEnoughSessionsLeft && (
        <p className="text-sm text-amber-600 mb-2">
          You have {remainingSessions} session{remainingSessions === 1 ? "" : "s"} left this period.
          Reduce quantity to {remainingSessions} or use drop-in to pay for more.
        </p>
      )}
      {(subscription.status === "unpaid" || subscription.status === "past_due") && (
        <p className="text-sm text-red-500 mb-2">
          Your Subscription is past due. Please pay your subscription to
          continue.
        </p>
      )}
      {subscription.cancelAt &&
        new Date(subscription.cancelAt) < new Date(lessonDate) && (
          <p className="text-sm text-red-500 mb-2">
            {`Your subscription currently ends on ${new Date(subscription.cancelAt).toLocaleDateString()} please upgrade your plan.`}
          </p>
        )}
      <PlanDetail
        plan={subscription.plan}
        actionLabel="Manage Subscription"
        onAction={onCreateCustomerPortal}
      />
    </>
  );
}
