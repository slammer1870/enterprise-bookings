"use client";

import { useEffect, useState } from "react";
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
import {
  DropInView,
  type FeeBreakdownComponentProps,
} from "./drop-ins";
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
   * Called when the user has started a payment redirect (e.g. to Stripe).
   * Use this to avoid cancelling pending bookings when the page unloads for the redirect.
   */
  onPaymentRedirectStart?: () => void;
  /**
   * Override the server endpoint used to create a PaymentIntent (drop-ins).
   * Defaults to the bookings-payments plugin endpoint served via Payload's API.
   */
  createPaymentIntentUrl?: string;
  /**
   * Optional component to show fee breakdown (class price, booking fee, total) in the drop-in tab.
   */
  FeeBreakdownComponent?: React.ComponentType<FeeBreakdownComponentProps>;
  /**
   * URL to redirect to after successful payment (checkout session, customer portal, drop-in).
   * Defaults to /dashboard for backwards compatibility with apps that use that route.
   */
  successUrl?: string;
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
 * Returns true if the plan's capacity can cover at least `requiredQuantity` bookings in a period.
 * Uses only the plan's session limit (sessions per period), not the user's usage.
 * Unlimited plans (no sessionsInformation or sessions <= 0) always return true.
 * Otherwise returns true when plan.sessionsInformation.sessions >= requiredQuantity.
 */
function planCanCoverQuantity(plan: unknown, requiredQuantity: number): boolean {
  if (requiredQuantity <= 0) return true;
  if (!plan || typeof plan !== "object") return false;
  const p = plan as {
    sessionsInformation?: {
      sessions?: number;
    };
  };
  const si = p.sessionsInformation;
  if (!si || si.sessions == null || si.sessions <= 0) return true; // Unlimited
  return si.sessions >= requiredQuantity;
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
  onPaymentRedirectStart,
  createPaymentIntentUrl,
  FeeBreakdownComponent,
  successUrl: successUrlProp,
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
  const remainingSessions = subscriptionData?.remainingSessions ?? null;
  const needsCustomerPortal = subscriptionData?.needsCustomerPortal ?? false;
  const upgradeOptions = subscriptionData?.upgradeOptions ?? [];

  // Create checkout session mutation for plans
  const { mutateAsync: createCheckoutSession } = useMutation(
    trpc.payments.createCustomerCheckoutSession.mutationOptions({
      onSuccess: (session: { url: string | null }) => {
        if (session.url) {
          onPaymentRedirectStart?.();
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
          onPaymentRedirectStart?.();
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
          onPaymentRedirectStart?.();
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

  const { mutateAsync: createBookingsWithSubscription } = useMutation(
    trpc.bookings.createBookings.mutationOptions({
      onSuccess: () => {
        onPaymentRedirectStart?.();
        const url = successUrlProp ?? "/dashboard";
        router.push(url.startsWith("http") ? url : `${typeof window !== "undefined" ? window.location.origin : ""}${url.startsWith("/") ? url : `/${url}`}`);
      },
      onError: (error: { message?: string }) => {
        toast.error(error.message || "Failed to book with membership");
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
    const metaWithTenant: Record<string, string> = {
      ...cleanMetadata,
      lessonId: String(lesson.id),
      ...(tenantId != null && { tenantId: String(tenantId) }),
    };
    if (pendingBookings && pendingBookings.length > 0) {
      metaWithTenant.bookingIds = pendingBookings
        .map((b) => b.id)
        .join(",");
    }

    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : process.env.NEXT_PUBLIC_SERVER_URL || "";
    // Include tenant in URL so when Stripe redirects back (cancel/success), middleware can restore
    // tenant context if the redirect lands on root domain (avoids redirect loop to home).
    const hostname =
      typeof window !== "undefined" ? window.location.hostname : "";
    const parts = hostname.split(".");
    const isLocalhost = hostname.includes("localhost");
    const tenantSlug =
      isLocalhost && parts.length > 1 && parts[0] && parts[0] !== "localhost"
        ? parts[0]
        : !isLocalhost && parts.length >= 3 && parts[0]
          ? parts[0]
          : null;
    const tenantQ = tenantSlug ? `?tenant=${encodeURIComponent(tenantSlug)}` : "";
    const baseSuccess = successUrlProp ?? "/dashboard";
    const successPath = baseSuccess.startsWith("http") ? baseSuccess : `${origin}${baseSuccess.startsWith("/") ? "" : "/"}${baseSuccess}`;
    await createCheckoutSession({
      priceId: planId,
      quantity: 1,
      metadata: metaWithTenant,
      mode: "subscription",
      successUrl: `${successPath}${tenantQ}`,
      cancelUrl: `${origin}/bookings/${lesson.id}${tenantQ}`,
    });
  };

  /** Return to the exact route the user came from after the customer portal (not a fixed success URL). */
  const getCustomerPortalReturnUrl = () => {
    if (typeof window === "undefined") return undefined;
    return `${window.location.origin}${window.location.pathname}${window.location.search || ""}`;
  };

  const handleCreateCustomerPortal = async () => {
    const returnUrl = getCustomerPortalReturnUrl();
    await createCustomerPortal({ returnUrl });
  };

  const handleCreateCustomerUpgradePortal = async (productId: string) => {
    const returnUrl = getCustomerPortalReturnUrl();
    await createCustomerUpgradePortal({ productId, returnUrl });
  };

  const allowedPlans = lesson.classOption.paymentMethods?.allowedPlans;
  const allowedDropIn = lesson.classOption.paymentMethods?.allowedDropIn;

  let activePlans = allowedPlans?.filter((plan) => plan.status === "active") ?? [];

  // Filter plan list by plan capacity only (not by user's usage): show only plans whose
  // per-period session limit can cover the selected quantity (sessions >= quantity or unlimited).
  activePlans = activePlans.filter((plan) =>
    planCanCoverQuantity(plan, quantity)
  );

  const hasSubscriptionWithPlan =
    subscription &&
    allowedPlans?.some((plan) => plan.id === subscription?.plan?.id);

  const userPlanAllowsMultiple =
    subscription?.plan &&
    planAllowsMultipleBookingsPerLesson(subscription.plan);

  const subscriptionUsableForBooking =
    subscription &&
    (subscription.status === "active" || subscription.status === "trialing");

  // For "use current subscription": require (1) valid payment status (active/trialing), (2) session headroom,
  // and (3) when quantity > 1, the plan must allow multiple bookings per lesson.
  const canUseSubscriptionForQuantity =
    hasSubscriptionWithPlan &&
    Boolean(subscriptionUsableForBooking) &&
    !subscriptionLimitReached &&
    (remainingSessions === null || remainingSessions >= quantity) &&
    (quantity <= 1 || Boolean(userPlanAllowsMultiple));

  // When quantity > 1: only show plans that allow multiple bookings per lesson
  if (quantity > 1) {
    activePlans = activePlans.filter((plan) =>
      planAllowsMultipleBookingsPerLesson(plan)
    );
  }

  // Membership tab: show if there are plans to subscribe/upgrade to, or user has subscription
  // (so we can show "use subscription", "N sessions left", limit reached, or past due + portal)
  let hasMembershipTab =
    activePlans.length > 0 || Boolean(hasSubscriptionWithPlan);
  // Show drop-in when: (1) no usable membership, or (2) quantity > 1 and drop-in allows multiple
  // (so members modifying a booking can pay for additional slots with drop-in)
  let hasDropInTab =
    Boolean(allowedDropIn) &&
    (!(hasSubscriptionWithPlan && subscriptionUsableForBooking) ||
      (quantity > 1 && dropInAllowsMultiple(allowedDropIn as DropIn)));

  if (quantity > 1) {
    hasMembershipTab =
      activePlans.length > 0 ||
      Boolean(hasSubscriptionWithPlan && userPlanAllowsMultiple);
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

  // Controlled tab so we can auto-switch to drop-in when membership is filtered out by quantity
  const defaultTab = hasMembershipTab ? "membership" : "dropin";
  const [activeTab, setActiveTab] = useState<string>(defaultTab);

  // When user increases quantity and membership is filtered out completely, show drop-in
  useEffect(() => {
    if (activeTab === "membership" && !hasMembershipTab && hasDropInTab) {
      setActiveTab("dropin");
    } else if (activeTab !== "membership" && activeTab !== "dropin") {
      setActiveTab(defaultTab);
    }
  }, [hasMembershipTab, hasDropInTab, defaultTab, activeTab]);

  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-medium">Payment Methods</h4>
        <p className="font-light text-sm">
          Please select a payment method to continue:
        </p>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
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
              remainingSessions={remainingSessions}
              selectedQuantity={quantity}
              canUseSubscriptionForQuantity={Boolean(canUseSubscriptionForQuantity)}
              subscriptionAllowsMultiplePerLesson={Boolean(userPlanAllowsMultiple)}
              needsCustomerPortal={needsCustomerPortal}
              upgradeOptions={upgradeOptions}
              onCreateCheckoutSession={handleCreateCheckoutSession}
              onCreateCustomerPortal={handleCreateCustomerPortal}
              onCreateCustomerUpgradePortal={handleCreateCustomerUpgradePortal}
              onConfirmBookingWithSubscription={
                subscription?.id != null
                  ? async (subscriptionId: number) => {
                      const pendingIds =
                        pendingBookings && pendingBookings.length > 0
                          ? pendingBookings.map((b) => b.id as number)
                          : undefined;
                      await createBookingsWithSubscription({
                        lessonId: lesson.id,
                        quantity: pendingIds ? pendingIds.length : quantity,
                        subscriptionId,
                        pendingBookingIds: pendingIds,
                      });
                    }
                  : undefined
              }
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
                onPaymentRedirectStart={onPaymentRedirectStart}
                createPaymentIntentUrl={createPaymentIntentUrl}
                FeeBreakdownComponent={FeeBreakdownComponent}
                returnUrl={successUrlProp}
                metadata={
                  pendingBookings && pendingBookings.length > 0
                    ? {
                        bookingIds: pendingBookings
                          .map((b) => b.id)
                          .join(","),
                        lessonId: lesson.id.toString(),
                      }
                    : {
                        lessonId: lesson.id.toString(),
                        quantity: String(quantity),
                      }
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
