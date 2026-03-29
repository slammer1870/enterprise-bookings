"use client";

import * as React from "react";
import { Plan, Subscription } from "@repo/shared-types";
import { PlanList } from "./plans/plan-list";
import { PlanDetail } from "./plans/plan-detail";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@repo/ui/components/ui/card";

export type UpgradeOption = {
  plan: Plan;
  maxAdditionalSessions: number;
};

export type PlanViewProps = {
  allowedPlans: Plan[] | undefined;
  subscription: Subscription | null;
  lessonDate: Date;
  subscriptionLimitReached: boolean;
  PlanPriceSummary?: React.ComponentType<{ plan: Plan }>;
  /** Remaining sessions in current period (null = unlimited). */
  remainingSessions?: number | null;
  /** Number of bookings selected on the page. */
  selectedQuantity?: number;
  /** When false, user cannot use subscription for current selection. */
  canUseSubscriptionForQuantity?: boolean;
  /** When false and selectedQuantity > 1, plan allows only one slot per lesson. */
  subscriptionAllowsMultiplePerLesson?: boolean;
  /** When true, show customer portal CTA (e.g. payment past due). */
  needsCustomerPortal?: boolean;
  /** Upgrade options with pro-rata additional sessions when limit reached. */
  upgradeOptions?: UpgradeOption[];
  onCreateCheckoutSession: (
    _planId: string,
    _metadata?: { [key: string]: string | undefined }
  ) => Promise<void>;
  onCreateCustomerPortal: () => Promise<void>;
  onCreateCustomerUpgradePortal?: (_planIdentifier: string | number) => Promise<void>;
  /** When set and canUseSubscriptionForQuantity, show "Use my membership" to book without paying. */
  onConfirmBookingWithSubscription?: (_subscriptionId: number) => Promise<void>;
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
  PlanPriceSummary,
  remainingSessions = null,
  selectedQuantity = 1,
  canUseSubscriptionForQuantity = true,
  subscriptionAllowsMultiplePerLesson = true,
  needsCustomerPortal = false,
  upgradeOptions = [],
  onCreateCheckoutSession,
  onCreateCustomerPortal,
  onCreateCustomerUpgradePortal,
  onConfirmBookingWithSubscription,
}: PlanViewProps) {
  const [isUsingMembership, setIsUsingMembership] = React.useState(false);

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
        PlanPriceSummary={PlanPriceSummary}
        onAction={onCreateCheckoutSession}
      />
    );
  }

  const hasMatchingPlan = allowedPlans.some(
    (plan) => plan.id === subscription.plan.id
  );

  if (!hasMatchingPlan) {
    const upgradeablePlans = allowedPlans.filter(
      (plan) => plan.id !== subscription.plan.id
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
                      onCreateCustomerUpgradePortal(plan.id)
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
            PlanPriceSummary={PlanPriceSummary}
            onAction={onCreateCheckoutSession}
          />
        )}
      </>
    );
  }

  // Only show "not enough sessions" when the limiting factor is session count (not per-lesson limit)
  const notEnoughSessionsLeft =
    !canUseSubscriptionForQuantity &&
    remainingSessions != null &&
    remainingSessions > 0 &&
    remainingSessions < selectedQuantity;

  const oneSlotPerLessonOnly =
    !canUseSubscriptionForQuantity &&
    selectedQuantity > 1 &&
    !subscriptionAllowsMultiplePerLesson;

  const showPastDueMessage = needsCustomerPortal || subscription.status === "unpaid" || subscription.status === "past_due";

  return (
    <>
      {subscriptionLimitReached && (
        <p className="text-sm text-red-500 mb-2">
          You have reached the limit of your subscription
        </p>
      )}
      {subscriptionLimitReached && upgradeOptions.length > 0 && (
        <div className="flex flex-col gap-3 mb-4">
          <p className="text-sm text-muted-foreground">
            Upgrade to get more sessions this period (pro-rata):
          </p>
          {upgradeOptions.map(({ plan, maxAdditionalSessions }) => (
            <Card key={plan.id}>
              <CardHeader>
                <CardTitle className="font-light">{plan.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {maxAdditionalSessions} more session{maxAdditionalSessions === 1 ? "" : "s"} this period
                </p>
              </CardContent>
              <CardFooter>
                {onCreateCustomerUpgradePortal ? (
                  <Button
                    className="w-full"
                    onClick={() =>
                      onCreateCustomerUpgradePortal(plan.id)
                    }
                  >
                    Upgrade
                  </Button>
                ) : (() => {
                  const priceJson = (plan as any).priceJSON;
                  const priceId =
                    typeof priceJson === "string"
                      ? JSON.parse(priceJson || "{}")?.id
                      : priceJson?.id;
                  return priceId ? (
                    <Button
                      className="w-full"
                      onClick={() =>
                        onCreateCheckoutSession(priceId, { lesson_id: String(lessonDate) })
                      }
                    >
                      Upgrade
                    </Button>
                  ) : (
                    <Button className="w-full" disabled>
                      Upgrade (not configured)
                    </Button>
                  );
                })()}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
      {oneSlotPerLessonOnly && (
        <p className="text-sm text-amber-600 mb-2">
          Your plan allows one slot per lesson. Use drop-in to pay for additional slots.
        </p>
      )}
      {notEnoughSessionsLeft && (
        <p className="text-sm text-amber-600 mb-2">
          You have {remainingSessions} session{remainingSessions === 1 ? "" : "s"} left this period.
          Reduce quantity to {remainingSessions} or use drop-in to pay for more.
        </p>
      )}
      {showPastDueMessage && (
        <p className="text-sm text-red-500 mb-2">
          Your subscription payment is past due. Please update your payment method to continue.
        </p>
      )}
      {subscription.cancelAt &&
        new Date(subscription.cancelAt) < new Date(lessonDate) && (
          <p className="text-sm text-red-500 mb-2">
            {`Your subscription currently ends on ${new Date(subscription.cancelAt).toLocaleDateString()} please upgrade your plan.`}
          </p>
        )}
      {canUseSubscriptionForQuantity && onConfirmBookingWithSubscription && subscription.id != null && (
        <div className="mb-4">
          <Button
            className="w-full"
            disabled={isUsingMembership}
            aria-busy={isUsingMembership}
            onClick={async () => {
              if (isUsingMembership) return;
              setIsUsingMembership(true);
              try {
                await onConfirmBookingWithSubscription(subscription.id as number);
              } finally {
                setIsUsingMembership(false);
              }
            }}
          >
            {isUsingMembership ? "Loading..." : "Use my membership"}
          </Button>
        </div>
      )}
      <PlanDetail
        plan={subscription.plan}
        actionLabel={showPastDueMessage ? "Update payment" : "Manage Subscription"}
        actionRequiresPriceId={false}
        PlanPriceSummary={PlanPriceSummary}
        onAction={onCreateCustomerPortal}
      />
    </>
  );
}
