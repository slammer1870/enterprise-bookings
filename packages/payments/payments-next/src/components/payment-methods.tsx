"use client";

import { Lesson } from "@repo/shared-types";
import { useTRPC } from "@repo/trpc/client";
import { useSuspenseQuery, useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/ui/components/ui/tabs";
import { PlanView } from "./plan-view";
import { DropInView } from "./drop-ins";
import { toast } from "sonner";

type PaymentMethodsProps = {
  lesson: Lesson;
};

/**
 * Component for displaying and managing payment methods for a lesson.
 * Uses tRPC procedures for data fetching and manipulation.
 */
export function PaymentMethods({ lesson }: PaymentMethodsProps) {
  const trpc = useTRPC();
  const router = useRouter();

  // Get subscription data for this lesson using tRPC
  const { data: subscriptionData } = useSuspenseQuery(
    trpc.subscriptions.getSubscriptionForLesson.queryOptions({
      lessonId: lesson.id,
    })
  );

  const { subscription, subscriptionLimitReached } = subscriptionData;

  // Create checkout session mutation for plans
  const { mutateAsync: createCheckoutSession } = useMutation(
    trpc.payments.createCustomerCheckoutSession.mutationOptions({
      onSuccess: (session: { url: string | null }) => {
        if (session.url) {
          router.push(session.url);
        } else {
          toast.error("Failed to create checkout session");
        }
      },
      onError: (error: { message?: string }) => {
        toast.error(error.message || "Failed to create checkout session");
      },
    })
  );

  // Create customer portal mutation
  const { mutateAsync: createCustomerPortal } = useMutation(
    trpc.payments.createCustomerPortal.mutationOptions({
      onSuccess: (session: { url: string | null }) => {
        if (session.url) {
          router.push(session.url);
        } else {
          toast.error("Failed to create customer portal");
        }
      },
      onError: (error: { message?: string }) => {
        toast.error(error.message || "Failed to create customer portal");
      },
    })
  );

  // Wrapper functions that use tRPC
  // planId here is actually the Stripe price ID from the plan's priceJSON
  const handleCreateCheckoutSession = async (
    planId: string,
    metadata?: { [key: string]: string | undefined }
  ) => {
    // Filter out undefined values to match Record<string, string> type
    const cleanMetadata: Record<string, string> = metadata
      ? Object.fromEntries(
          Object.entries(metadata).filter(
            (entry): entry is [string, string] => entry[1] !== undefined
          )
        )
      : {};

    await createCheckoutSession({
      priceId: planId,
      quantity: 1,
      metadata: cleanMetadata,
      mode: "subscription",
      successUrl: `${process.env.NEXT_PUBLIC_SERVER_URL}/dashboard`,
      cancelUrl: `${process.env.NEXT_PUBLIC_SERVER_URL}/bookings/${lesson.id}`,
    });
  };

  const handleCreateCustomerPortal = async () => {
    await createCustomerPortal();
  };

  const allowedPlans = lesson.classOption.paymentMethods?.allowedPlans;

  const activePlans = allowedPlans?.filter((plan) => plan.status === "active");

  const hasSubscriptionWithPlan =
    subscription &&
    allowedPlans?.some((plan) => plan.id === subscription?.plan?.id);

  const hasMembershipTab =
    Boolean(activePlans && activePlans.length > 0) || hasSubscriptionWithPlan;

  const hasDropInTab =
    Boolean(lesson.classOption.paymentMethods?.allowedDropIn) &&
    !hasSubscriptionWithPlan;

  if (!hasMembershipTab && !hasDropInTab) {
    return (
      <div className="rounded-md bg-yellow-50 p-4 text-sm text-yellow-800">
        <p>No payment methods are available for this lesson.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-medium">Payment Methods</h4>
        <p className="font-light text-sm">
          Please select a payment method to continue:
        </p>
      </div>
      <Tabs defaultValue={hasMembershipTab ? "membership" : "dropin"}>
        <TabsList className="flex w-full justify-around gap-4">
          {hasMembershipTab && (
            <TabsTrigger value="membership" className="w-full">
              Membership
            </TabsTrigger>
          )}
          {hasDropInTab && (
            <TabsTrigger value="dropin" className="w-full">
              Drop-in
            </TabsTrigger>
          )}
        </TabsList>
        {hasMembershipTab && (
          <TabsContent value="membership">
            <PlanView
              allowedPlans={activePlans}
              subscription={subscription}
              lessonDate={new Date(lesson.startTime)}
              subscriptionLimitReached={subscriptionLimitReached}
              onCreateCheckoutSession={handleCreateCheckoutSession}
              onCreateCustomerPortal={handleCreateCustomerPortal}
            />
          </TabsContent>
        )}
        {hasDropInTab && (
          <TabsContent value="dropin">
            {lesson.classOption.paymentMethods?.allowedDropIn ? (
              <DropInView
                bookingStatus={lesson.bookingStatus}
                dropIn={lesson.classOption.paymentMethods.allowedDropIn}
                quantity={1}
                metadata={{
                  lessonId: lesson.id.toString(),
                }}
              />
            ) : (
              <div>Drop-in payment option is not available</div>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
