import { Plan, Subscription } from "@repo/shared-types";

import { PlanList } from "./plan-list";
import { PlanDetail } from "./plan-detail";

import {
  createCheckoutSession,
  createCustomerPortal,
} from "../../actions/plans";

import { hasReachedSubscriptionLimit } from "@repo/shared-services/src/subscription";

type PlanViewProps = {
  allowedPlans: Plan[] | undefined;
  subscription: Subscription | null;
  lessonDate: Date;
};

export const PlanView = ({
  allowedPlans,
  subscription,
  lessonDate,
}: PlanViewProps) => {
  return (
    <div>
      {!allowedPlans ? (
        <p className="text-sm text-muted-foreground">
          No plans are available for this lesson
        </p>
      ) : (
        <div>
          {!subscription ? (
            <PlanList
              plans={allowedPlans}
              actionLabel="Subscribe"
              onAction={createCheckoutSession}
            />
          ) : (
            <div>
              {!allowedPlans.some(
                (plan) => plan.id === subscription.plan.id
              ) ? (
                <>
                  <p className="text-sm text-muted-foreground mb-2">
                    You do not have a plan that allows you to book into this
                    lesson, please upgrade your plan to continue
                  </p>
                  <PlanList
                    plans={allowedPlans.filter(
                      (plan) => plan.id !== subscription.plan.id
                    )}
                    actionLabel="Upgrade"
                    onAction={createCheckoutSession}
                  />
                </>
              ) : (
                <>
                  {true && (
                    <p className="text-sm text-muted-foreground mb-2">
                      You have reached the limit of your subscription
                    </p>
                  )}
                  {subscription.status === "unpaid" ||
                    (subscription.status === "past_due" && (
                      <p className="text-sm text-muted-foreground mb-2">
                        Your Subscription is past due. Please pay your
                        subscription to continue.
                      </p>
                    ))}
                  {subscription.cancelAt &&
                    new Date(subscription.cancelAt) < new Date(lessonDate) && (
                      <p className="text-sm text-muted-foreground mb-2">
                        {`Your subscription currently ends on ${new Date(subscription.cancelAt).toLocaleDateString()} please upgrade your plan or wait for it to renew before booking again`}
                      </p>
                    )}
                  <PlanDetail
                    plan={subscription.plan}
                    actionLabel="Manage Subscription"
                    onAction={createCustomerPortal}
                  />
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
