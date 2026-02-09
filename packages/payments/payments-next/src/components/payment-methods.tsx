"use client";

import { Lesson, Booking, DropIn } from "@repo/shared-types";
import { useTRPC } from "@repo/trpc/client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/ui/components/ui/tabs";
import { PlanView } from "@repo/membership-next";
import { DropInView } from "./drop-ins";
import { toast } from "sonner";

type PaymentMethodsProps = {
  lesson: Lesson;
  /** Quantity of bookings being paid for. When > 1, only payment methods that allow multiple bookings are shown. */
  quantity?: number;
  /** Pending bookings to confirm on payment. When provided, quantity defaults to pendingBookings.length. */
  pendingBookings?: Booking[];
  /** Callback when payment succeeds (e.g. to refresh manage page) */
  onPaymentSuccess?: () => void;
  /**
   * Override the server endpoint used to create a PaymentIntent (drop-ins).
   * Defaults to the bookings-payments plugin endpoint served via Payload's API.
   */
  createPaymentIntentUrl?: string;
};

/**
 * Returns true if the drop-in allows multiple bookings per lesson.
 */
function dropInAllowsMultiple(dropIn: unknown): boolean {
  if (!dropIn || typeof dropIn !== "object") return false;
  const d = dropIn as { adjustable?: boolean };
  return d.adjustable === true;
}

/**
 * Returns true if the plan allows multiple bookings per lesson.
 * Plans without sessionsInformation (unlimited) always allow multiple.
 * Plans with sessionsInformation allow multiple only when allowMultipleBookingsPerLesson is true.
 */
function planAllowsMultipleBookingsPerLesson(plan: unknown): boolean {
  if (!plan || typeof plan !== "object") return false;
  const p = plan as {
    sessionsInformation?: {
      sessions?: number;
      allowMultipleBookingsPerLesson?: boolean;
    };
  };
  const si = p.sessionsInformation;
  if (!si || si.sessions == null || si.sessions <= 0) return true; // Unlimited
  return si.allowMultipleBookingsPerLesson === true;
}

/**
 * Component for displaying and managing payment methods for a lesson.
 * When quantity > 1, only shows payment methods that allow multiple bookings per lesson.
 * Uses tRPC procedures for data fetching and manipulation.
 */
export function PaymentMethods({
  lesson,
  quantity: quantityProp,
  pendingBookings,
  onPaymentSuccess: _onPaymentSuccess,
  createPaymentIntentUrl,
}: PaymentMethodsProps) {
  const trpc = useTRPC();
  const router = useRouter();

  const quantity = pendingBookings?.length ?? quantityProp ?? 1;

  // Get subscription data for this lesson using tRPC
  const { data: subscriptionData } = useQuery(
    trpc.subscriptions.getSubscriptionForLesson.queryOptions({
      lessonId: lesson.id,
    })
  );

  const subscription = subscriptionData?.subscription ?? null;
  const subscriptionLimitReached = subscriptionData?.subscriptionLimitReached ?? false;

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
    const tenantId =
      lesson.tenant != null
        ? typeof lesson.tenant === "object" && "id" in lesson.tenant
          ? lesson.tenant.id
          : lesson.tenant
        : undefined;
    const metaWithTenant = {
      ...cleanMetadata,
      ...(tenantId != null && { tenantId: String(tenantId) }),
    };

    await createCheckoutSession({
      priceId: planId,
      quantity: 1,
      metadata: metaWithTenant,
      mode: "subscription",
      successUrl: `${process.env.NEXT_PUBLIC_SERVER_URL}/dashboard`,
      cancelUrl: `${process.env.NEXT_PUBLIC_SERVER_URL}/bookings/${lesson.id}`,
    });
  };

  const handleCreateCustomerPortal = async () => {
    await createCustomerPortal();
  };

  const handleCreateCustomerUpgradePortal = async (productId: string) => {
    await createCustomerUpgradePortal({ productId });
  };

  const allowedPlans = lesson.classOption.paymentMethods?.allowedPlans;
  const allowedDropIn = lesson.classOption.paymentMethods?.allowedDropIn;

  let activePlans = allowedPlans?.filter((plan) => plan.status === "active") ?? [];

  const hasSubscriptionWithPlan =
    subscription &&
    allowedPlans?.some((plan) => plan.id === subscription?.plan?.id);

  // Base visibility (quantity 1): membership tab if plans exist or user has subscription; drop-in if configured and no subscription
  let hasMembershipTab =
    activePlans.length > 0 || Boolean(hasSubscriptionWithPlan);
  let hasDropInTab =
    Boolean(allowedDropIn) && !hasSubscriptionWithPlan;

  // When multiple bookings: only show methods that allow multiple per lesson
  if (quantity > 1) {
    activePlans = activePlans.filter((plan) =>
      planAllowsMultipleBookingsPerLesson(plan)
    );
    const userPlanAllowsMultiple =
      subscription?.plan &&
      planAllowsMultipleBookingsPerLesson(subscription.plan);
    hasMembershipTab =
      activePlans.length > 0 || Boolean(hasSubscriptionWithPlan && userPlanAllowsMultiple);
    hasDropInTab =
      hasDropInTab && dropInAllowsMultiple(allowedDropIn as DropIn);
  }

  if (!hasMembershipTab && !hasDropInTab) {
    return (
      <div className="rounded-md bg-yellow-50 p-4 text-sm text-yellow-800">
        <p>
          {quantity > 1
            ? "No payment methods are available for multiple bookings. Try reducing the quantity or use a different payment method."
            : "No payment methods are available for this lesson."}
        </p>
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
              onCreateCustomerUpgradePortal={handleCreateCustomerUpgradePortal}
            />
          </TabsContent>
        )}
        {hasDropInTab && (
          <TabsContent value="dropin">
            {allowedDropIn ? (
              <DropInView
                bookingStatus={lesson.bookingStatus}
                dropIn={allowedDropIn as DropIn}
                quantity={quantity}
                createPaymentIntentUrl={createPaymentIntentUrl}
                metadata={
                  pendingBookings && pendingBookings.length > 0
                    ? {
                        bookingIds: pendingBookings
                          .map((b) => b.id)
                          .join(","),
                        lessonId: lesson.id.toString(),
                      }
                    : { lessonId: lesson.id.toString() }
                }
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
