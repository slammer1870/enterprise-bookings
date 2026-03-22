"use client";

import { Lesson } from "@repo/shared-types";
import { useTRPC } from "@repo/trpc/client";
import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PlanView } from "@repo/membership-next";
import type { Plan } from "@repo/shared-types";
import { useMemo } from "react";

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

  const tenantId =
    lesson.tenant != null
      ? typeof lesson.tenant === "object" && "id" in lesson.tenant
        ? lesson.tenant.id
        : lesson.tenant
      : null;

  const PlanPriceSummary = useMemo(() => {
    return function PlanPriceSummaryImpl({ plan }: { plan: Plan }) {
      const priceJson = plan?.priceJSON;
      const priceId =
        typeof priceJson === "string"
          ? JSON.parse(priceJson || "{}")?.id
          : (priceJson as any)?.id;

      const qty = 1;
      const enabled = typeof priceId === "string" && priceId.length > 0;
      const queryOpts = trpc.payments.getSubscriptionFeeBreakdown.queryOptions({
        priceId: priceId || "",
        quantity: qty,
        metadata: tenantId != null ? { tenantId: String(tenantId) } : {},
      });
      const { data, isLoading } = useQuery({ ...queryOpts, enabled });

      if (!enabled) return null;
      if (isLoading) {
        return <div className="text-sm text-muted-foreground">Calculating fees…</div>;
      }
      if (!data) return null;
      if ((data.bookingFeeCents ?? 0) <= 0) return null;

      const fmt = new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: (data.currency || "eur").toUpperCase(),
      });
      const fee = (data.bookingFeeCents ?? 0) / 100;
      const total = (data.totalCents ?? 0) / 100;

      return (
        <div className="text-sm text-muted-foreground">
          <div className="flex items-center justify-between gap-3">
            <span>Booking fee</span>
            <span>{fmt.format(fee)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>Total (est.)</span>
            <span>{fmt.format(total)}</span>
          </div>
        </div>
      );
    };
  }, [tenantId, trpc.payments.getSubscriptionFeeBreakdown]);

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
    await createCheckoutSession({
      priceId,
      quantity: 1,
      metadata: metaWithTenant,
      mode: "subscription",
      successUrl: `${origin}/dashboard${tenantQ}`,
      cancelUrl: `${origin}/bookings/${lesson.id}${tenantQ}`,
    });
  };

  const allowedPlans = lesson.classOption.paymentMethods?.allowedPlans;
  const allowedPlanDocs: Plan[] = Array.isArray(allowedPlans)
    ? (allowedPlans.filter(
        (p: unknown): p is Plan => typeof p === "object" && p != null && "id" in p
      ) as Plan[])
    : [];
  // UI should not offer subscribing to inactive legacy plans, but users with an existing
  // subscription to an inactive plan should still be able to use it for booking.
  const activePlans = allowedPlanDocs.filter((plan) => plan.status === "active");
  const currentSubscriptionPlan =
    subscription && subscription.plan && typeof subscription.plan === "object" && subscription.plan != null
      ? (subscription.plan as Plan)
      : null;
  const subscriptionPlanIsAllowed =
    currentSubscriptionPlan != null && allowedPlanDocs.some((p) => p.id === currentSubscriptionPlan.id);
  const plansForView: Plan[] =
    subscriptionPlanIsAllowed && currentSubscriptionPlan?.status !== "active"
      ? [currentSubscriptionPlan, ...activePlans]
      : activePlans;

  const hasSubscriptionWithPlan =
    subscription && allowedPlanDocs.some((plan) => plan.id === subscription?.plan?.id);

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
      allowedPlans={plansForView}
      subscription={subscription}
      lessonDate={new Date(lesson.startTime)}
      subscriptionLimitReached={subscriptionLimitReached}
      PlanPriceSummary={PlanPriceSummary}
      onCreateCheckoutSession={handleCreateCheckoutSession}
      onCreateCustomerPortal={async () => {
        const returnUrl =
          typeof window !== "undefined"
            ? `${window.location.origin}/dashboard`
            : undefined;
        await createCustomerPortal({
          returnUrl,
          ...(tenantId != null ? { tenantId } : {}),
        });
      }}
      onCreateCustomerUpgradePortal={async (planIdentifier) => {
        const returnUrl =
          typeof window !== "undefined"
            ? `${window.location.origin}/dashboard`
            : undefined;
        await createCustomerUpgradePortal({ planId: planIdentifier, returnUrl });
      }}
    />
  );
}


