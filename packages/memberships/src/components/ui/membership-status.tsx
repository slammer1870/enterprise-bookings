import { Lesson, Plan, Subscription } from "@repo/shared-types";

import { BasePayload } from "payload";

import { PlanList } from "../plans/plan-list";
import { SubscriptionStatusMessages } from "./subscription-status";

type SubscriptionWithDates = Subscription & {
  endDate?: string | Date;
  startDate?: string | Date;
};

type MembershipStatusProps = {
  subscription: Subscription & {
    plan: Plan;
  };
  allowedPlans: Plan[];
  lesson: Lesson;
  payload: BasePayload;
};

// Helper function to check if lesson is past subscription end date
function isLessonPastSubscriptionEnd(
  lessonDate: Date,
  subscription?: Subscription
): boolean {
  if (!subscription?.endDate) return false;
  const subscriptionEndDate = new Date(subscription.endDate);
  return lessonDate > subscriptionEndDate;
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export const MembershipStatus = ({
  subscription,
  allowedPlans,
  lesson,
  payload,
}: MembershipStatusProps) => {
  const lessonDate = new Date(lesson.date);

  // If no subscription, show available plans
  if (!subscription) {
    return (
      <>
        <p className="text-muted-foreground mb-4">
          Please select a membership plan to book this class
        </p>
        <PlanList plans={allowedPlans} />
      </>
    );
  }

  // Check if lesson is past subscription end date
  if (isLessonPastSubscriptionEnd(lessonDate, subscription)) {
    return (
      <>
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
          <p className="text-yellow-700">
            This lesson is scheduled for after your membership expires (
            {subscription.endDate
              ? new Date(subscription.endDate).toDateString()
              : "unknown"}
            ).
          </p>
          <p>Please wait for your subscription to renew before booking again</p>
        </div>
      </>
    );
  }

  // Check if current plan is allowed for this lesson
  const isAllowedPlan = allowedPlans?.some(
    (plan) => plan.id == subscription.plan.id
  );
  if (!isAllowedPlan) {
    return (
      <>
        <p className="text-red-500 mb-4">
          Your current membership plan doesn't include access to this type of
          class. Please upgrade to one of the following plans:
        </p>
        <PlanList
          plans={allowedPlans.filter(
            (plan) => plan.id !== subscription.plan.id
          )}
        />
      </>
    );
  }

  // If we get here, show regular subscription status
  return (
    <SubscriptionStatusMessages
      subscription={subscription}
      lessonDate={lessonDate}
      payload={payload}
    />
  );
};
