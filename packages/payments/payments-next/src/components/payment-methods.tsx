"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Lesson, Booking, DropIn, type Plan } from "@repo/shared-types";
import { useTRPC } from "@repo/trpc/client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/ui/components/ui/tabs";
import { Input } from "@repo/ui/components/ui/input";
import { Button } from "@repo/ui/components/ui/button";
import { PlanView } from "@repo/membership-next";
import {
  DropInView,
  type FeeBreakdownComponentProps,
} from "./drop-ins";
import { toast } from "sonner";
import {
  getMembershipPlansForView,
  planAllowsMultipleBookingsPerLesson,
} from "./membership-plan-filter";

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
   * Override the endpoint used to create a subscription checkout session.
   * Defaults to tRPC `payments.createCustomerCheckoutSession`.
   */
  createCheckoutSessionUrl?: string;
  /** Optional endpoint used to validate a customer-entered discount code before checkout. */
  validateDiscountCodeUrl?: string;
  /**
   * URL to redirect to after successful payment (checkout session, customer portal, drop-in).
   * Defaults to /dashboard for backwards compatibility with apps that use that route.
   */
  successUrl?: string;
};

type CheckoutSessionInput = {
  priceId: string;
  quantity?: number;
  metadata?: Record<string, string>;
  discountCode?: string;
  successUrl?: string;
  cancelUrl?: string;
  mode: "subscription" | "payment";
};

type ValidatedDiscount = {
  code: string;
  type: "percentage_off" | "amount_off";
  value: number;
  currency?: string | null;
};

/** Pass-like shape from getValidClassPassesForLesson */
type ClassPassForLesson = {
  id: number;
  quantity?: number;
  expirationDate?: string;
  type?: number | { name?: string };
};

type PurchasableClassPassType = {
  id: number;
  name: string;
  description?: string | null;
  quantity: number;
  allowMultipleBookingsPerLesson: boolean;
  price?: number | null;
  priceId: string;
};

function ClassPassTabContent({
  passes,
  purchasablePassTypes,
  quantity,
  onConfirm,
  onPurchase,
}: {
  passes: ClassPassForLesson[];
  purchasablePassTypes: PurchasableClassPassType[];
  quantity: number;
  onConfirm: (_classPassId: number) => Promise<void>;
  onPurchase: (_passType: PurchasableClassPassType) => Promise<void>;
}) {
  const [selectedPassId, setSelectedPassId] = useState<number | null>(
    passes.length === 1 && passes[0] != null ? passes[0].id : null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [purchasePassTypeId, setPurchasePassTypeId] = useState<number | null>(null);

  // Auto-select when the single valid pass loads asynchronously (queries resolve after mount)
  useEffect(() => {
    if (passes.length === 1 && passes[0] != null && selectedPassId == null) {
      setSelectedPassId(passes[0].id);
    }
  }, [passes, selectedPassId]);

  const handleConfirm = async () => {
    if (selectedPassId == null) return;
    setIsSubmitting(true);
    try {
      await onConfirm(selectedPassId);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (passes.length === 0 && purchasablePassTypes.length === 0) {
    return (
      <div className="rounded-md bg-yellow-50 p-4 text-sm text-yellow-800">
        <p className="font-medium">No valid class pass</p>
        <p className="mt-1">
          You don&apos;t have a valid class pass for this lesson. Contact the organiser to obtain one.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {passes.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Use a class pass to book. This will use {quantity} credit{quantity !== 1 ? "s" : ""} from your pass.
          </p>
          <div className="space-y-2">
            {passes.map((pass) => {
              const typeName =
                typeof pass.type === "object" && pass.type != null && "name" in pass.type
                  ? (pass.type as { name?: string }).name
                  : "Class pass";
              const exp =
                pass.expirationDate != null
                  ? new Date(pass.expirationDate).toLocaleDateString()
                  : null;
              return (
                <div
                  key={pass.id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{typeName}</span>
                    <span className="text-sm text-muted-foreground">
                      {pass.quantity ?? 0} credit{(pass.quantity ?? 0) !== 1 ? "s" : ""} remaining
                      {exp ? ` · Expires ${exp}` : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="classPass"
                      checked={selectedPassId === pass.id}
                      onChange={() => setSelectedPassId(pass.id)}
                      className="h-4 w-4"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPassId(pass.id);
                        void handleConfirm();
                      }}
                      disabled={isSubmitting}
                      className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      Use this pass
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={selectedPassId == null || isSubmitting}
            className="w-full rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isSubmitting ? "Booking..." : "Confirm with class pass"}
          </button>
        </div>
      )}
      {purchasablePassTypes.length > 0 && (
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-sm font-medium">Buy a class pass</p>
            <p className="text-sm text-muted-foreground">
              No valid pass yet? Buy one here, then return to confirm this booking with it.
            </p>
          </div>
          <div className="space-y-2">
            {purchasablePassTypes.map((passType) => (
              <div key={passType.id} className="rounded-md border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="font-medium">{passType.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {passType.quantity} credit{passType.quantity !== 1 ? "s" : ""}
                      {passType.price != null ? ` · €${passType.price.toFixed(2)}` : ""}
                    </div>
                    {passType.description ? (
                      <p className="text-sm text-muted-foreground">{passType.description}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        setPurchasePassTypeId(passType.id);
                        await onPurchase(passType);
                      } finally {
                        setPurchasePassTypeId((current) => (current === passType.id ? null : current));
                      }
                    }}
                    disabled={purchasePassTypeId != null}
                    className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
                  >
                    {purchasePassTypeId === passType.id ? "Redirecting..." : "Buy pass"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Returns true if the drop-in allows multiple bookings per lesson.
 */
function dropInAllowsMultiple(dropIn: unknown): boolean {
  if (!dropIn || typeof dropIn !== "object") return false;
  const d = dropIn as { adjustable?: boolean };
  return d.adjustable === true;
}

function getPendingBookingIds(pendingBookings?: Booking[]): number[] {
  const ids: number[] = [];
  const seen = new Set<number>();
  for (const booking of pendingBookings ?? []) {
    if (String(booking.status).toLowerCase() !== "pending") {
      continue;
    }
    const id = Number(booking.id);
    if (!Number.isFinite(id)) {
      continue;
    }
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    ids.push(id);
  }
  return ids;
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
  createCheckoutSessionUrl,
  validateDiscountCodeUrl,
  FeeBreakdownComponent,
  successUrl: successUrlProp,
}: PaymentMethodsProps) {
  const trpc = useTRPC();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialDiscountCode = (searchParams?.get("discount") || "").trim() || undefined;
  const [discountCodeInput, setDiscountCodeInput] = useState(initialDiscountCode ?? "");
  const [appliedDiscountCode, setAppliedDiscountCode] = useState<string | undefined>(
    validateDiscountCodeUrl ? undefined : initialDiscountCode
  );
  const [appliedDiscount, setAppliedDiscount] = useState<ValidatedDiscount | undefined>();
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [discountSuccess, setDiscountSuccess] = useState<string | null>(
    validateDiscountCodeUrl ? null : initialDiscountCode ? "Promo code applied." : null
  );
  const [isValidatingDiscountCode, setIsValidatingDiscountCode] = useState(false);

  const pendingBookingIds = getPendingBookingIds(pendingBookings);
  const hasPendingBookings = pendingBookingIds.length > 0;
  const quantity = hasPendingBookings ? pendingBookingIds.length : quantityProp ?? 1;

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

  // Get subscription data for this lesson using tRPC
  const { data: subscriptionData } = useQuery(
    trpc.subscriptions.getSubscriptionForLesson.queryOptions({
      lessonId: lesson.id,
      quantity,
    })
  );

  // Get valid class passes for this lesson (Phase 4.6)
  const { data: validClassPasses = [] } = useQuery(
    trpc.bookings.getValidClassPassesForLesson.queryOptions({
      lessonId: lesson.id,
      quantity,
    })
  );
  const { data: purchasableClassPassTypes = [] } = useQuery(
    trpc.bookings.getPurchasableClassPassTypesForLesson.queryOptions({
      lessonId: lesson.id,
      quantity,
    })
  );

  const subscription = subscriptionData?.subscription ?? null;
  const subscriptionLimitReached = subscriptionData?.subscriptionLimitReached ?? false;
  const remainingSessions = subscriptionData?.remainingSessions ?? null;
  const needsCustomerPortal = subscriptionData?.needsCustomerPortal ?? false;
  const upgradeOptions = subscriptionData?.upgradeOptions ?? [];
  const eligiblePlansForQuantity = subscriptionData?.eligiblePlansForQuantity ?? null;

  const startCheckoutRedirect = (session: { url: string | null }) => {
    if (session.url) {
      onPaymentRedirectStart?.();
      router.push(session.url);
    } else {
      toast.error("Failed to create checkout session");
    }
  };

  const handleCheckoutError = (error: { message?: string }) => {
    toast.error(error.message || "Failed to create checkout session");
  };

  const validateDiscountCode = useCallback(async (rawDiscountCode: string) => {
    const normalizedCode = rawDiscountCode.trim().toUpperCase();
    if (!normalizedCode) {
      setAppliedDiscountCode(undefined);
      setAppliedDiscount(undefined);
      setDiscountError(null);
      setDiscountSuccess(null);
      return false;
    }

    if (!/^[A-Z0-9]{3,24}$/.test(normalizedCode)) {
      setAppliedDiscountCode(undefined);
      setAppliedDiscount(undefined);
      setDiscountSuccess(null);
      setDiscountError("Code must be 3-24 characters, letters and numbers only.");
      return false;
    }

    if (!validateDiscountCodeUrl) {
      setAppliedDiscountCode(normalizedCode);
      setAppliedDiscount(undefined);
      setDiscountError(null);
      setDiscountSuccess("Promo code applied.");
      return true;
    }

    setIsValidatingDiscountCode(true);
    setDiscountError(null);
    setDiscountSuccess(null);
    try {
      const response = await fetch(validateDiscountCodeUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          discountCode: normalizedCode,
          metadata: tenantId != null ? { tenantId: String(tenantId), lessonId: String(lesson.id) } : { lessonId: String(lesson.id) },
        }),
      });

      if (!response.ok) {
        let message = "Invalid or inactive discount code.";
        try {
          const payload = await response.json();
          if (typeof payload?.error === "string") {
            message = payload.error;
          }
        } catch {
          // Ignore parse failures and use fallback message
        }
        setAppliedDiscountCode(undefined);
        setAppliedDiscount(undefined);
        setDiscountError(message);
        return false;
      }

      const payload = (await response.json()) as {
        discountCode?: string;
        discount?: {
          type?: ValidatedDiscount["type"];
          value?: number;
          currency?: string | null;
        };
      };
      const resolvedCode =
        typeof payload.discountCode === "string" && payload.discountCode.trim()
          ? payload.discountCode.trim().toUpperCase()
          : normalizedCode;
      setDiscountCodeInput(normalizedCode);
      setAppliedDiscountCode(resolvedCode);
      setAppliedDiscount(
        payload.discount?.type && typeof payload.discount?.value === "number"
          ? {
              code: resolvedCode,
              type: payload.discount.type,
              value: payload.discount.value,
              currency: payload.discount.currency ?? null,
            }
          : undefined
      );
      setDiscountSuccess("Promo code applied.");
      return true;
    } finally {
      setIsValidatingDiscountCode(false);
    }
  }, [lesson.id, tenantId, validateDiscountCodeUrl]);

  useEffect(() => {
    if (!initialDiscountCode || !validateDiscountCodeUrl) {
      return;
    }
    void validateDiscountCode(initialDiscountCode);
  }, [initialDiscountCode, validateDiscountCode, validateDiscountCodeUrl]);

  // Create checkout session mutation for plans (default: tRPC)
  const { mutateAsync: createCheckoutSessionWithTRPC } = useMutation(
    trpc.payments.createCustomerCheckoutSession.mutationOptions({
      onSuccess: startCheckoutRedirect,
      onError: handleCheckoutError,
    })
  );

  const { mutateAsync: createCheckoutSessionWithAPI } = useMutation({
    mutationFn: async (variables: CheckoutSessionInput) => {
      if (!createCheckoutSessionUrl) {
        throw new Error("Checkout session endpoint is not configured");
      }

      const response = await fetch(createCheckoutSessionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(variables),
      });

      if (!response.ok) {
        let message = "Failed to create checkout session";
        try {
          const payload = await response.json();
          if (typeof payload?.error === "string") {
            message = payload.error;
          }
        } catch {
          // Ignore parse failures and use fallback message
        }
        throw new Error(message);
      }

      return response.json();
    },
    onSuccess: startCheckoutRedirect,
    onError: handleCheckoutError,
  });

  const createCheckoutSession = createCheckoutSessionUrl
    ? async (variables: CheckoutSessionInput) => createCheckoutSessionWithAPI(variables)
    : async (variables: CheckoutSessionInput) => createCheckoutSessionWithTRPC(variables);

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

  const { mutateAsync: createBookingsWithClassPass } = useMutation(
    trpc.bookings.createBookings.mutationOptions({
      onSuccess: () => {
        onPaymentRedirectStart?.();
        const url = successUrlProp ?? "/dashboard";
        router.push(url.startsWith("http") ? url : `${typeof window !== "undefined" ? window.location.origin : ""}${url.startsWith("/") ? url : `/${url}`}`);
      },
      onError: (error: { message?: string }) => {
        toast.error(error.message || "Failed to book with class pass");
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
    if (hasPendingBookings) {
      metaWithTenant.bookingIds = pendingBookingIds.join(",");
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

  const handleCreateClassPassCheckout = async (passType: PurchasableClassPassType) => {
    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : process.env.NEXT_PUBLIC_SERVER_URL || "";
    const currentPath =
      typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search || ""}`
        : `/bookings/${lesson.id}`;
    const tenantIdForMeta =
      lesson.tenant != null
        ? typeof lesson.tenant === "object" && "id" in lesson.tenant
          ? lesson.tenant.id
          : lesson.tenant
        : undefined;

    await createCheckoutSession({
      priceId: passType.priceId,
      quantity: 1,
      mode: "payment",
      metadata: {
        type: "class_pass_purchase",
        classPassTypeId: String(passType.id),
        lessonId: String(lesson.id),
        bookingQuantity: String(quantity),
        ...(tenantIdForMeta != null ? { tenantId: String(tenantIdForMeta) } : {}),
        ...(hasPendingBookings ? { bookingIds: pendingBookingIds.join(",") } : {}),
      },
      successUrl: `${origin}${currentPath}`,
      cancelUrl: `${origin}${currentPath}`,
    });
  };

  /** Return to the exact route the user came from after the customer portal (not a fixed success URL). */
  const getCustomerPortalReturnUrl = () => {
    if (typeof window === "undefined") return undefined;
    return `${window.location.origin}${window.location.pathname}${window.location.search || ""}`;
  };

  const handleCreateCustomerPortal = async () => {
    const returnUrl = getCustomerPortalReturnUrl();
    await createCustomerPortal({
      returnUrl,
      ...(tenantId != null ? { tenantId } : {}),
    });
  };

  const handleCreateCustomerUpgradePortal = async (planIdentifier: string | number) => {
    const returnUrl = getCustomerPortalReturnUrl();
    await createCustomerUpgradePortal({ planId: planIdentifier, returnUrl });
  };

  const allowedPlans = lesson.classOption.paymentMethods?.allowedPlans;
  const allowedPlanDocs: Plan[] = Array.isArray(allowedPlans)
    ? (allowedPlans.filter(
        (p: unknown): p is Plan => typeof p === "object" && p != null && "id" in p
      ) as Plan[])
    : [];
  const allowedDropIn = lesson.classOption.paymentMethods?.allowedDropIn;
  const allowedClassPasses = (lesson.classOption.paymentMethods as { allowedClassPasses?: unknown[] } | undefined)
    ?.allowedClassPasses;

  const plansForView = getMembershipPlansForView({
    allowedPlanDocs,
    eligiblePlansForQuantity,
    quantity,
    subscription,
  });
  let activePlans = plansForView.filter((plan) => plan.status === "active");

  const hasSubscriptionWithPlan =
    subscription &&
    allowedPlanDocs.some((plan) => plan.id === subscription?.plan?.id);

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

  // Class pass tab: show when class option allows class passes and user has at least one valid pass that can cover quantity
  const classPassesWithEnoughCredits: ClassPassForLesson[] = Array.isArray(validClassPasses)
    ? validClassPasses.flatMap((p) => {
        if (
          typeof p !== "object" ||
          p == null ||
          typeof (p as { id?: unknown }).id !== "number" ||
          typeof (p as { quantity?: unknown }).quantity !== "number" ||
          ((p as { quantity: number }).quantity < quantity)
        ) {
          return [];
        }
        return [p as ClassPassForLesson];
      })
    : [];
  const purchasablePassesForQuantity: PurchasableClassPassType[] = Array.isArray(purchasableClassPassTypes)
    ? purchasableClassPassTypes.flatMap((passType) => {
        if (
          typeof passType !== "object" ||
          passType == null ||
          typeof passType.id !== "number" ||
          typeof passType.priceId !== "string" ||
          passType.priceId.length === 0
        ) {
          return [];
        }
        return [passType as PurchasableClassPassType];
      })
    : [];
  const hasClassPassTab = Boolean(allowedClassPasses?.length);

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

  const availableTabs = useMemo(() => {
    const tabs: string[] = [];
    if (hasMembershipTab) tabs.push("membership");
    if (hasClassPassTab) tabs.push("classpass");
    if (hasDropInTab) tabs.push("dropin");
    return tabs;
  }, [hasMembershipTab, hasDropInTab, hasClassPassTab]);

  // Controlled tab so we can auto-switch when the active tab is no longer available
  const defaultTab = availableTabs[0] ?? "dropin";
  const [activeTab, setActiveTab] = useState<string>(defaultTab);

  // When active tab becomes unavailable (or invalid), switch to a valid tab.
  useEffect(() => {
    if (availableTabs.length === 0) return;
    if (!availableTabs.includes(activeTab)) {
      setActiveTab(defaultTab);
    }
  }, [activeTab, availableTabs, defaultTab]);

  // Important: keep this after hooks so changing quantity doesn't break hook order.
  if (!hasMembershipTab && !hasDropInTab && !hasClassPassTab) {
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
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex w-full justify-around gap-4">
          {hasMembershipTab && (
            <TabsTrigger value="membership" className="w-full">
              Membership
            </TabsTrigger>
          )}
          {hasClassPassTab && (
            <TabsTrigger value="classpass" className="w-full">
              Class pass
            </TabsTrigger>
          )}
          {hasDropInTab && (
            <TabsTrigger value="dropin" className="w-full">
              Drop-in
            </TabsTrigger>
          )}
        </TabsList>
        {hasClassPassTab && (
          <TabsContent value="classpass">
            <ClassPassTabContent
              passes={classPassesWithEnoughCredits}
              purchasablePassTypes={purchasablePassesForQuantity}
              quantity={quantity}
              onConfirm={async (classPassId: number) => {
                await createBookingsWithClassPass({
                  lessonId: lesson.id,
                  quantity: hasPendingBookings ? pendingBookingIds.length : quantity,
                  classPassId,
                  pendingBookingIds: hasPendingBookings ? pendingBookingIds : undefined,
                });
              }}
              onPurchase={handleCreateClassPassCheckout}
            />
          </TabsContent>
        )}
        {hasMembershipTab && (
          <TabsContent value="membership">
            <PlanView
              allowedPlans={plansForView}
              subscription={subscription}
              lessonDate={new Date(lesson.startTime)}
              subscriptionLimitReached={subscriptionLimitReached}
              remainingSessions={remainingSessions}
              selectedQuantity={quantity}
              canUseSubscriptionForQuantity={Boolean(canUseSubscriptionForQuantity)}
              subscriptionAllowsMultiplePerLesson={Boolean(userPlanAllowsMultiple)}
              needsCustomerPortal={needsCustomerPortal}
              upgradeOptions={upgradeOptions}
              PlanPriceSummary={PlanPriceSummary}
              onCreateCheckoutSession={handleCreateCheckoutSession}
              onCreateCustomerPortal={handleCreateCustomerPortal}
              onCreateCustomerUpgradePortal={handleCreateCustomerUpgradePortal}
              onConfirmBookingWithSubscription={
                subscription?.id != null
                  ? async (subscriptionId: number) => {
                      const pendingIds = hasPendingBookings ? pendingBookingIds : undefined;
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
            <div className="mb-4 rounded-md border p-4 space-y-3">
              <div className="space-y-1">
                <p className="text-sm font-medium">Promo code</p>
                <p className="text-sm text-muted-foreground">
                  Apply your promo code before completing a drop-in booking.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  aria-label="Promo code"
                  placeholder="Enter promo code"
                  value={discountCodeInput}
                  onChange={(event) => {
                    const nextValue = event.target.value.toUpperCase();
                    setDiscountCodeInput(nextValue);
                    if (
                      appliedDiscountCode &&
                      nextValue.trim().toUpperCase() !== appliedDiscountCode.trim().toUpperCase()
                    ) {
                      setAppliedDiscountCode(undefined);
                      setAppliedDiscount(undefined);
                    }
                    setDiscountError(null);
                    setDiscountSuccess(null);
                  }}
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={isValidatingDiscountCode}
                    onClick={() => {
                      void validateDiscountCode(discountCodeInput);
                    }}
                  >
                    {isValidatingDiscountCode ? "Applying..." : "Apply"}
                  </Button>
                  {appliedDiscountCode ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setAppliedDiscountCode(undefined);
                        setAppliedDiscount(undefined);
                        setDiscountError(null);
                        setDiscountSuccess(null);
                      }}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
              </div>
              {discountError ? (
                <p className="text-sm text-destructive">{discountError}</p>
              ) : null}
              {!discountError && discountSuccess ? (
                <p className="text-sm text-green-600">{discountSuccess}</p>
              ) : null}
            </div>
            {allowedDropIn ? (
              <DropInView
                bookingStatus={lesson.bookingStatus}
                dropIn={allowedDropIn as DropIn}
                quantity={quantity}
                discountCode={appliedDiscountCode}
                discount={appliedDiscount}
                onPaymentRedirectStart={onPaymentRedirectStart}
                createPaymentIntentUrl={createPaymentIntentUrl}
                FeeBreakdownComponent={FeeBreakdownComponent}
                returnUrl={successUrlProp}
                metadata={
                  hasPendingBookings
                    ? {
                        bookingIds: pendingBookingIds.join(","),
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
