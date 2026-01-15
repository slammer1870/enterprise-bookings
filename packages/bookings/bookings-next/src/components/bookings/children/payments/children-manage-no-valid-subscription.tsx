"use client";

import { ClassOption, Lesson, Plan } from "@repo/shared-types";
import { useTRPC } from "@repo/trpc/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@repo/ui/components/ui/card";

import { ChildrenPaymentTabs } from "./children-payment-tabs";

export function ChildrenManageNoValidSubscription({
  paymentMethods,
  lessonId,
  bookingStatus,
  remainingCapacity,
}: {
  paymentMethods: ClassOption["paymentMethods"];
  lessonId: number;
  bookingStatus: Lesson["bookingStatus"];
  remainingCapacity: number;
}) {
  const trpc = useTRPC();

  const { data: subscription } = useQuery(trpc.subscriptions.getSubscription.queryOptions());

  const { mutate: createCustomerUpgradePortal, isPending: isCreatingUpgradePortal } = useMutation(
    trpc.payments.createCustomerUpgradePortal.mutationOptions({
      onSuccess: (data: any) => {
        if (data?.url) window.location.href = data.url;
      },
      onError: (error: any) => {
        toast.error("Error creating checkout session");
        console.error(error);
      },
      onMutate: () => toast.loading("Creating checkout session"),
      onSettled: () => toast.dismiss(),
    })
  );

  const activePlans = (paymentMethods?.allowedPlans || []).filter(
    (plan: any) => plan?.stripeProductId && plan?.status === "active"
  ) as Plan[];

  // No subscription at all => allow user to pay/subscribe using standard tabs
  if (!subscription) {
    return (
      <ChildrenPaymentTabs
        paymentMethods={paymentMethods}
        lessonId={lessonId}
        bookingStatus={bookingStatus}
        remainingCapacity={remainingCapacity}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      <p>
        You do not have a valid subscription to book this lesson. You can upgrade your subscription
        to book this lesson.
      </p>

      {activePlans.map((plan) => (
        <Card key={plan.id}>
          <CardHeader>
            <CardTitle className="font-light">{plan.name}</CardTitle>
          </CardHeader>
          <CardContent />
          <CardFooter>
            <Button
              className="w-full"
              disabled={isCreatingUpgradePortal}
              onClick={() =>
                createCustomerUpgradePortal({
                  productId: (plan as any).stripeProductId as string,
                })
              }
            >
              {isCreatingUpgradePortal ? "Loading..." : "Upgrade Subscription"}
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}


