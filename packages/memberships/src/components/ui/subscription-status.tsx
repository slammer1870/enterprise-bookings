import { Subscription } from "@repo/shared-types";

import { BasePayload } from "payload";

import { hasReachedSubscriptionLimit } from "@repo/shared-services";

type SubscriptionStatusMessagesProps = {
  subscription: Subscription;
  lessonDate: Date;
  payload: BasePayload;
};

export async function SubscriptionStatusMessages({
  subscription,
  lessonDate,
  payload,
}: SubscriptionStatusMessagesProps) {
  const hasReachedLimit = await hasReachedSubscriptionLimit(
    subscription,
    payload,
    lessonDate
  );
  const subscriptionEndDate = subscription.endDate
    ? new Date(subscription.endDate)
    : null;
  const isExpired = subscriptionEndDate && subscriptionEndDate <= lessonDate;

  return (
    <div className="space-y-4">
      {subscription.status === "unpaid" && (
        <p className="text-yellow-600">
          Please pay your subscription to continue
        </p>
      )}

      {hasReachedLimit && (
        <p className="text-red-500">
          You have reached your subscription limit, please upgrade to continue
        </p>
      )}

      {isExpired && (
        <p className="bg-secondary-foreground text-secondary/80 p-2 rounded-md">
          This lesson is past the end date of your subscription, please wait for
          your subscription to renew before booking again
        </p>
      )}

      {!hasReachedLimit && !isExpired && subscription.status !== "unpaid" && (
        <p className="text-green-600">
          You are subscribed to this plan and eligible to book
        </p>
      )}
    </div>
  );
}
