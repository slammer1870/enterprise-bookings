"use client";

import { Lesson } from "@repo/shared-types";
import { useTRPC } from "@repo/trpc/client";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PlanView } from "@repo/membership-next";

type MembershipPaymentMethodsProps = {
  lesson: Lesson;
};

/**
 * Like PaymentMethods, but **membership-only** (no drop-in/tab UI).
 * Useful for gyms that do not support drop-ins.
 */
export function MembershipPaymentMethods({ lesson }: MembershipPaymentMethodsProps) {
  const trpc = useTRPC();
  const router = useRouter();

  const { data: subscriptionData } = useSuspenseQuery(
    trpc.subscriptions.getSubscriptionForLesson.queryOptions({
      lessonId: lesson.id,
    })
  );

  const { subscription, subscriptionLimitReached } = subscriptionData;

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

  const { mutateAsync: createCustomerUpgradePortal } = useMutation(
    trpc.payments.createCustomerUpgradePortal.mutationOptions({
      onSuccess: (session: { url: string | null }) => {
        if (session.url) {
          router.push(session.url);
        } else {
          toast.error("Failed to create upgrade portal");
        }
      },
      onError: (error: { message?: string }) => {
        toast.error(error.message || "Failed to create upgrade portal");
      },
    })
  );

  const handleCreateCheckoutSession = async (
    priceId: string,
    metadata?: { [key: string]: string | undefined }
  ) => {
    const cleanMetadata: Record<string, string> = metadata
      ? Object.fromEntries(
          Object.entries(metadata).filter(
            (entry): entry is [string, string] => entry[1] !== undefined
          )
        )
      : {};

    await createCheckoutSession({
      priceId,
      quantity: 1,
      metadata: cleanMetadata,
      mode: "subscription",
      successUrl: `${process.env.NEXT_PUBLIC_SERVER_URL}/dashboard`,
      cancelUrl: `${process.env.NEXT_PUBLIC_SERVER_URL}/bookings/${lesson.id}`,
    });
  };

  const allowedPlans = lesson.classOption.paymentMethods?.allowedPlans;
  const activePlans = allowedPlans?.filter((plan) => plan.status === "active");

  const hasSubscriptionWithPlan =
    subscription && allowedPlans?.some((plan) => plan.id === subscription?.plan?.id);

  const hasMembership = Boolean(activePlans && activePlans.length > 0) || hasSubscriptionWithPlan;

  if (!hasMembership) {
    return (
      <div className="rounded-md bg-yellow-50 p-4 text-sm text-yellow-800">
        <p>No membership plans are available for this lesson.</p>
      </div>
    );
  }

  return (
    <PlanView
      allowedPlans={activePlans}
      subscription={subscription}
      lessonDate={new Date(lesson.startTime)}
      subscriptionLimitReached={subscriptionLimitReached}
      onCreateCheckoutSession={handleCreateCheckoutSession}
      onCreateCustomerPortal={async () => {
        await createCustomerPortal();
      }}
      onCreateCustomerUpgradePortal={async (productId) => {
        await createCustomerUpgradePortal({ productId });
      }}
    />
  );
}


