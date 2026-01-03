"use client";

import { ClassOption, Lesson } from "@repo/shared-types";
import { useTRPC } from "@repo/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";

import { ChildrenManageNoValidSubscription } from "./children-manage-no-valid-subscription";
import { ChildrenValidateSubscription } from "./children-validate-subscription";

/**
 * Standard "children payment gate" (bru-grappling methodology):
 * - if user has valid subscription for any allowed plans => validate subscription (limits/status) then render form
 * - else => show payment options / upgrade options
 */
export function ChildrenPaymentGateway({
  paymentMethods,
  lessonDate,
  lessonId,
  bookingStatus,
  remainingCapacity,
}: {
  paymentMethods?: ClassOption["paymentMethods"];
  lessonDate: Date;
  lessonId: number;
  bookingStatus: Lesson["bookingStatus"];
  remainingCapacity: number;
}) {
  const trpc = useTRPC();

  const { data } = useSuspenseQuery(
    trpc.subscriptions.hasValidSubscription.queryOptions({
      plans: paymentMethods?.allowedPlans?.map((plan: any) => plan.id) || [],
    })
  );

  if (!data) {
    return (
      <ChildrenManageNoValidSubscription
        paymentMethods={paymentMethods as any}
        lessonId={lessonId}
        bookingStatus={bookingStatus}
        remainingCapacity={remainingCapacity}
      />
    );
  }

  return (
    <ChildrenValidateSubscription subscription={data} lessonDate={lessonDate} lessonId={lessonId} />
  );
}


