import { z } from "zod";

import {
  stripeProtectedProcedure,
  protectedProcedure,
  requireBookingCollections,
  requireCollections,
  type GetSubscriptionBookingFeeCents,
} from "../trpc";
import { findSafe } from "../utils/collections";
import {
  buildMultiItemSubscriptionUpgradeItems,
  findExactApplicationFeePercent,
  selectPlanSubscriptionItem,
} from "../utils/subscription-upgrade-items";
import {
  resolveUpgradeChargeAmountCents,
  resolveUpgradeChargeTiming,
  sumProrationLineCents,
  type UpgradeProrationBehavior,
} from "../utils/subscription-upgrade-preview";
import { TRPCError } from "@trpc/server";
import Stripe from "stripe";

export type GetDropInFeeBreakdown = (_params: {
  payload: any;
  timeslotId: number;
  classPriceCents: number;
  originalClassPriceCents?: number;
  promoDiscountCents?: number;
}) => Promise<{
  classPriceCents: number;
  originalClassPriceCents?: number;
  promoDiscountCents?: number;
  bookingFeeCents: number;
  totalCents: number;
  originalBookingFeeCents?: number;
  originalTotalCents?: number;
}>;

export type GetClassPassFeeBreakdown = (_params: {
  payload: any;
  classPassTypeId: number;
  classPriceCents: number;
}) => Promise<{
  classPriceCents: number;
  bookingFeeCents: number;
  totalCents: number;
}>;

export type CreatePaymentsRouterDeps = {
  getSubscriptionBookingFeeCents?: GetSubscriptionBookingFeeCents;
  getDropInFeeBreakdown?: GetDropInFeeBreakdown;
  getClassPassFeeBreakdown?: GetClassPassFeeBreakdown;
};

/**
 * Stripe success/cancel/portal URLs must land on the host the user is browsing (custom domain,
 * tenant subdomain). Prefer request headers over NEXT_PUBLIC_SERVER_URL.
 */
function publicOriginFromTrpcContext(ctx: {
  headers: Headers;
  hostOverride?: string | null;
}): string {
  const rawOverride = ctx.hostOverride?.trim();
  if (rawOverride?.includes("://")) {
    try {
      return new URL(rawOverride).origin;
    } catch {
      /* fall through */
    }
  }
  const forwardedProto = ctx.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim();
  const forwardedHost = ctx.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim();
  const hostHeader = ctx.headers.get("host")?.trim();
  const host = rawOverride || forwardedHost || hostHeader;
  if (host) {
    const proto =
      forwardedProto ||
      (host.startsWith("localhost") ||
      host.startsWith("127.0.0.1") ||
      /^\d+\.\d+\.\d+\.\d+/.test(host)
        ? "http"
        : "https");
    return `${proto}://${host}`;
  }
  return (
    process.env.NEXT_PUBLIC_SERVER_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

async function resolveStripeAccountIdFromMetadata(params: {
  payload: any;
  metadata?: Record<string, string>;
}): Promise<string | null> {
  const { payload, metadata } = params;
  const tenantIdRaw = metadata?.tenantId;
  if (!payload || typeof tenantIdRaw !== "string") return null;
  const tenantId = parseInt(tenantIdRaw, 10);
  if (!Number.isFinite(tenantId)) return null;

  const tenant = await payload
    .findByID({
      collection: "tenants",
      id: tenantId,
      depth: 0,
      overrideAccess: true,
    })
    .catch(() => null);

  const t = tenant as
    | {
        stripeConnectAccountId?: string | null;
        stripeConnectOnboardingStatus?: string | null;
      }
    | null;

  const accountId =
    typeof t?.stripeConnectAccountId === "string"
      ? t.stripeConnectAccountId.trim()
      : "";
  if (!accountId) return null;
  if (t?.stripeConnectOnboardingStatus !== "active") return null;
  return accountId;
}

function coerceNumericId(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && /^\d+$/.test(raw.trim())) {
    const n = parseInt(raw.trim(), 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

async function resolvePayloadUser(params: {
  payload: any;
  sessionUser: any;
}): Promise<{ id: number; email?: string | null; name?: string | null }> {
  const { payload, sessionUser } = params;
  const directId = coerceNumericId(sessionUser?.id);
  if (directId != null) {
    const doc = await payload
      .findByID({
        collection: "users",
        id: directId,
        depth: 0,
        overrideAccess: true,
      })
      .catch(() => null);
    if (doc) {
      return {
        id: directId,
        email: (doc as any)?.email ?? sessionUser?.email ?? null,
        name: (doc as any)?.name ?? sessionUser?.name ?? null,
      };
    }
  }

  const email =
    typeof sessionUser?.email === "string" ? sessionUser.email.trim() : "";
  if (!email) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "User not found" });
  }

  const res = await payload
    .find({
      collection: "users",
      where: { email: { equals: email } },
      depth: 0,
      limit: 1,
      overrideAccess: true,
    })
    .catch(() => null);

  const found = (res as any)?.docs?.[0] as any | undefined;
  const id = coerceNumericId(found?.id);
  if (id == null) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "User not found" });
  }
  return {
    id,
    email,
    name:
      typeof found?.name === "string"
        ? found.name
        : typeof sessionUser?.name === "string"
          ? sessionUser.name
          : null,
  };
}

function normalizeStripeAccountId(accountId: string | null | undefined): string | null {
  const a = typeof accountId === "string" ? accountId.trim() : "";
  return a ? a : null;
}

function getPlatformStripeCustomerId(userDoc: any): string | null {
  const id =
    typeof userDoc?.stripeCustomerId === "string"
      ? userDoc.stripeCustomerId.trim()
      : "";
  return id ? id : null;
}

function getConnectStripeCustomerId(userDoc: any, stripeAccountId: string): string | null {
  const arr = Array.isArray(userDoc?.stripeCustomers) ? userDoc.stripeCustomers : [];
  const found = arr.find(
    (x: any) =>
      x &&
      typeof x === "object" &&
      x.stripeAccountId === stripeAccountId &&
      typeof x.stripeCustomerId === "string" &&
      x.stripeCustomerId.trim()
  );
  return found ? String(found.stripeCustomerId).trim() : null;
}

async function ensureStripeCustomerIdForAccount(params: {
  payload: any;
  stripe: Stripe;
  userId: number;
  email?: string | null;
  name?: string | null;
  stripeAccountId?: string | null;
}): Promise<{ stripeCustomerId: string; stripeAccountId: string | null }> {
  const { payload, stripe, userId } = params;
  const stripeAccountId = normalizeStripeAccountId(params.stripeAccountId);

  const userDoc = await payload.findByID({
    collection: "users",
    id: userId,
    depth: 1,
    overrideAccess: true,
  });
  if (!userDoc) throw new Error("User not found");

  const email = (params.email ?? userDoc?.email ?? null) as string | null;
  if (!email) throw new Error("User email is required to resolve Stripe customer");

  if (stripeAccountId) {
    const existing = getConnectStripeCustomerId(userDoc, stripeAccountId);
    if (existing) return { stripeCustomerId: existing, stripeAccountId };
  } else {
    const existing = getPlatformStripeCustomerId(userDoc);
    if (existing) return { stripeCustomerId: existing, stripeAccountId: null };
  }

  const stripeOpts = stripeAccountId
    ? ({ stripeAccount: stripeAccountId } satisfies Stripe.RequestOptions)
    : undefined;
  const existingCustomer = await stripe.customers.list(
    { email, limit: 1 },
    stripeOpts
  );
  const foundId = existingCustomer?.data?.[0]?.id
    ? String(existingCustomer.data[0].id)
    : null;
  const customerId =
    foundId ??
    (
      await stripe.customers.create(
        { name: (params.name ?? userDoc?.name ?? "") || undefined, email },
        stripeOpts
      )
    ).id;

  if (stripeAccountId) {
    const existing = Array.isArray(userDoc?.stripeCustomers)
      ? userDoc.stripeCustomers
      : [];
    const next = [
      ...existing.filter((x: any) => x?.stripeAccountId !== stripeAccountId),
      { stripeAccountId, stripeCustomerId: customerId },
    ];
    await payload.update({
      collection: "users",
      id: userId,
      data: { stripeCustomers: next } as Record<string, unknown>,
      overrideAccess: true,
    });
    return { stripeCustomerId: customerId, stripeAccountId };
  }

  if (!getPlatformStripeCustomerId(userDoc)) {
    await payload.update({
      collection: "users",
      id: userId,
      data: { stripeCustomerId: customerId } as Record<string, unknown>,
      overrideAccess: true,
    });
  }

  return { stripeCustomerId: customerId, stripeAccountId: null };
}

async function removeConnectCustomerMappingForAccount(
  payload: any,
  userId: number,
  stripeAccountId: string
): Promise<void> {
  const acct =
    typeof stripeAccountId === "string" ? stripeAccountId.trim() : "";
  if (!acct) return;
  const userDoc = await payload.findByID({
    collection: "users",
    id: userId,
    depth: 0,
    overrideAccess: true,
  });
  if (!userDoc) return;
  const existing = Array.isArray((userDoc as any).stripeCustomers)
    ? (userDoc as any).stripeCustomers
    : [];
  const next = existing.filter((x: any) => x?.stripeAccountId !== acct);
  if (next.length === existing.length) return;
  await payload.update({
    collection: "users",
    id: userId,
    data: { stripeCustomers: next },
    overrideAccess: true,
  });
}

function isStripeMissingConnectCustomerError(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const err = e as { code?: string; param?: string; type?: string; message?: string };
  if (err.code !== "resource_missing" || err.param !== "customer") return false;
  if (
    typeof err.message === "string" &&
    err.message.toLowerCase().includes("no such customer")
  ) {
    return true;
  }
  return err.type === "StripeInvalidRequestError";
}

function parsePlanStripePriceId(plan: any): string {
  const raw = plan?.priceJSON;
  const parsed =
    typeof raw === "string"
      ? JSON.parse(raw || "{}")
      : raw && typeof raw === "object"
        ? raw
        : {};
  const id = (parsed as any)?.id;
  if (typeof id !== "string" || !id.trim()) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Plan is missing Stripe price configuration",
    });
  }
  return id;
}

function resolvePlanIdInput(raw: unknown): number | string | null {
  const n = coerceNumericId(raw);
  if (n != null) return n;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  return null;
}

type CustomerSubscriptionUpgradeContext = {
  plan: any;
  planTenantId: number | null;
  priceId: string;
  stripeProductId: string;
  customerId: string;
  stripeSubscriptionId: string;
  stripeOpts: Stripe.RequestOptions | undefined;
};

/**
 * Shared plan + subscription resolution for upgrade preview and confirm.
 */
async function resolveCustomerSubscriptionUpgradeContext(params: {
  payload: any;
  stripe: Stripe;
  sessionUser: any;
  productId?: string;
  planId?: number | string;
}): Promise<CustomerSubscriptionUpgradeContext> {
  const { payload, stripe, sessionUser } = params;

  let plan: any | null = null;

  if (params.planId != null) {
    const id = resolvePlanIdInput(params.planId);
    if (id == null) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid planId" });
    }
    plan = await payload
      .findByID({
        collection: "plans" as any,
        id,
        depth: 0,
        overrideAccess: true,
      })
      .catch(() => null);
  } else if (params.productId) {
    const found = await findSafe(payload, "plans", {
      where: { stripeProductId: { equals: params.productId } },
      depth: 0,
      limit: 1,
      overrideAccess: true,
    });
    plan = found?.docs?.[0] ?? null;
  }

  if (!plan) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Plan not found" });
  }

  const stripeProductId =
    typeof plan?.stripeProductId === "string" && plan.stripeProductId.trim()
      ? plan.stripeProductId.trim()
      : null;

  if (!stripeProductId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Plan is missing Stripe product configuration",
    });
  }

  const priceId = parsePlanStripePriceId(plan);

  const payloadUser = await resolvePayloadUser({
    payload,
    sessionUser,
  });
  const planTenantId =
    typeof plan?.tenant === "object" && plan.tenant != null && "id" in plan.tenant
      ? coerceNumericId((plan.tenant as any).id)
      : coerceNumericId(plan?.tenant);

  const activeOrTrialing = await findSafe<any>(payload, "subscriptions", {
    where: {
      user: { equals: payloadUser.id },
      status: { in: ["active", "trialing"] },
      ...(planTenantId != null ? { tenant: { equals: planTenantId } } : {}),
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    sort: "-createdAt",
  });

  const fallbackPastDue = async () => {
    const past = await findSafe<any>(payload, "subscriptions", {
      where: {
        user: { equals: payloadUser.id },
        status: { in: ["past_due", "unpaid"] },
        ...(planTenantId != null ? { tenant: { equals: planTenantId } } : {}),
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      sort: "-createdAt",
    });
    return past?.docs?.[0] ?? null;
  };

  const subscriptionId =
    activeOrTrialing?.docs?.[0]?.id ?? (await fallbackPastDue())?.id ?? null;

  if (subscriptionId == null) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "No subscription found",
    });
  }

  const subscriptionDoc = await payload
    .findByID({
      collection: "subscriptions" as any,
      id: subscriptionId,
      depth: 0,
      overrideAccess: true,
    })
    .catch(() => null);

  if (!subscriptionDoc) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "No subscription found",
    });
  }

  const stripeAccountId =
    typeof (subscriptionDoc as any)?.stripeAccountId === "string" &&
    (subscriptionDoc as any).stripeAccountId.trim()
      ? (subscriptionDoc as any).stripeAccountId.trim()
      : null;

  const tenantDoc =
    planTenantId != null
      ? await payload
          .findByID({
            collection: "tenants" as any,
            id: planTenantId,
            depth: 0,
            overrideAccess: true,
          })
          .catch(() => null)
      : null;
  const tenantStripeAccountId =
    tenantDoc &&
    typeof (tenantDoc as any)?.stripeConnectAccountId === "string" &&
    (tenantDoc as any).stripeConnectAccountId.trim() &&
    (tenantDoc as any)?.stripeConnectOnboardingStatus === "active"
      ? String((tenantDoc as any).stripeConnectAccountId).trim()
      : null;

  const stripeAccountIdForPortal = stripeAccountId ?? tenantStripeAccountId;

  const stripeOpts = stripeAccountIdForPortal
    ? ({ stripeAccount: stripeAccountIdForPortal } satisfies Stripe.RequestOptions)
    : undefined;

  const directCustomerId =
    stripeAccountIdForPortal &&
    typeof (subscriptionDoc as any)?.stripeCustomerId === "string" &&
    (subscriptionDoc as any).stripeCustomerId.trim()
      ? (subscriptionDoc as any).stripeCustomerId.trim()
      : null;

  const customerId =
    directCustomerId ??
    (
      await ensureStripeCustomerIdForAccount({
        payload,
        stripe,
        userId: payloadUser.id,
        email: payloadUser.email ?? null,
        name: payloadUser.name ?? null,
        stripeAccountId: stripeAccountIdForPortal,
      })
    ).stripeCustomerId;

  let stripeSubscriptionId =
    typeof (subscriptionDoc as any)?.stripeSubscriptionId === "string" &&
    (subscriptionDoc as any).stripeSubscriptionId.trim()
      ? (subscriptionDoc as any).stripeSubscriptionId.trim()
      : null;

  if (!stripeSubscriptionId) {
    if (process.env.NODE_ENV === "test" || process.env.ENABLE_TEST_WEBHOOKS === "true") {
      stripeSubscriptionId = `sub_test_upgrade_${subscriptionId}`;
    } else {
      const list = await stripe.subscriptions.list(
        {
          customer: customerId,
          limit: 5,
          status: "all",
        },
        stripeOpts,
      );
      const candidate =
        list.data.find(
          (s) =>
            s.status === "active" ||
            s.status === "trialing" ||
            s.status === "past_due" ||
            s.status === "unpaid",
        ) ??
        list.data[0] ??
        null;
      stripeSubscriptionId = candidate?.id ?? null;
    }
  }

  if (!stripeSubscriptionId) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "No subscription found",
    });
  }

  return {
    plan,
    planTenantId,
    priceId,
    stripeProductId,
    customerId,
    stripeSubscriptionId,
    stripeOpts,
  };
}

async function buildUpgradeSubscriptionItemUpdates(params: {
  stripe: Stripe;
  stripeOpts: Stripe.RequestOptions | undefined;
  subscriptionItems: Stripe.SubscriptionItem[];
  priceId: string;
  planTenantId: number | null;
  payload: any;
  getFee?: GetSubscriptionBookingFeeCents;
}): Promise<{
  itemUpdates: Stripe.SubscriptionUpdateParams.Item[];
  unitAmount: number;
  bookingFeeCents: number;
  currency: string;
  prorationBehavior: UpgradeProrationBehavior;
}> {
  const {
    stripe,
    stripeOpts,
    subscriptionItems,
    priceId,
    planTenantId,
    payload,
    getFee,
  } = params;

  const newPlanPrice = await stripe.prices.retrieve(priceId, {}, stripeOpts);
  const unitAmount =
    typeof newPlanPrice.unit_amount === "number" ? newPlanPrice.unit_amount : 0;
  const currency = (newPlanPrice.currency || "eur").toLowerCase();
  const recurring = newPlanPrice.recurring;

  const multiItem = subscriptionItems.length > 1;
  const prorationBehavior: UpgradeProrationBehavior = multiItem
    ? "always_invoice"
    : "create_prorations";

  if (!multiItem) {
    const planItem = selectPlanSubscriptionItem(subscriptionItems);
    if (!planItem) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Subscription has no items to upgrade",
      });
    }
    return {
      itemUpdates: [{ id: planItem.id, price: priceId }],
      unitAmount,
      bookingFeeCents: 0,
      currency,
      prorationBehavior,
    };
  }

  let bookingFeeCents = 0;
  if (getFee && payload && planTenantId != null && unitAmount > 0) {
    try {
      const feeCents = await getFee({
        payload,
        tenantId: planTenantId,
        classPriceAmountCents: unitAmount,
        metadata: { tenantId: String(planTenantId) },
      });
      if (typeof feeCents === "number" && feeCents > 0) {
        bookingFeeCents = feeCents;
      }
    } catch (e) {
      console.warn("Subscription upgrade booking fee lookup failed", e);
    }
  }

  let newFeePriceId: string | null = null;
  if (bookingFeeCents > 0 && recurring) {
    const feePrice = await stripe.prices.create(
      {
        currency,
        unit_amount: bookingFeeCents,
        recurring: {
          interval: recurring.interval,
          interval_count: recurring.interval_count ?? 1,
        },
        product_data: {
          name: "Platform fee",
        },
      },
      stripeOpts,
    );
    newFeePriceId = feePrice.id;
  }

  const itemUpdates = buildMultiItemSubscriptionUpgradeItems({
    items: subscriptionItems,
    newPlanPriceId: priceId,
    newFeePriceId,
  });

  return {
    itemUpdates,
    unitAmount,
    bookingFeeCents,
    currency,
    prorationBehavior,
  };
}

export function createPaymentsRouter(deps?: CreatePaymentsRouterDeps) {
  const getFee = deps?.getSubscriptionBookingFeeCents;
  const getDropInFeeBreakdown = deps?.getDropInFeeBreakdown;
  const getClassPassFeeBreakdown = deps?.getClassPassFeeBreakdown;

  return {
    ...(getDropInFeeBreakdown && {
      /**
       * Returns fee breakdown for drop-in checkout (class price, booking fee, total).
       */
      getDropInFeeBreakdown: protectedProcedure
        .use(requireBookingCollections("timeslots"))
        .use(requireCollections("tenants"))
        .input(
          z.object({
            timeslotId: z.number(),
            classPriceCents: z.number().min(0),
            originalClassPriceCents: z.number().min(0).optional(),
            promoDiscountCents: z.number().min(0).optional(),
          })
        )
        .query(({ ctx, input }) =>
          getDropInFeeBreakdown({
            payload: ctx.payload,
            timeslotId: input.timeslotId,
            classPriceCents: input.classPriceCents,
            originalClassPriceCents: input.originalClassPriceCents,
            promoDiscountCents: input.promoDiscountCents,
          })
        ),
    }),
    ...(getClassPassFeeBreakdown && {
      /**
       * Returns fee breakdown for class pass purchase (class price, booking fee, total).
       */
      getClassPassFeeBreakdown: protectedProcedure
        .input(
          z.object({
            classPassTypeId: z.number(),
            classPriceCents: z.number().min(0),
          })
        )
        .query(({ ctx, input }) =>
          getClassPassFeeBreakdown({
            payload: ctx.payload,
            classPassTypeId: input.classPassTypeId,
            classPriceCents: input.classPriceCents,
          })
        ),
    }),
    /**
     * Returns fee breakdown for subscription checkout (plan price, booking fee, total).
     * Mirrors the same fee calculation used by createCustomerCheckoutSession.
     */
    getSubscriptionFeeBreakdown: stripeProtectedProcedure
      .input(
        z.object({
          priceId: z.string(),
          quantity: z.number().optional(),
          metadata: z.record(z.string(), z.string()).optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        if (process.env.NODE_ENV === "test" || process.env.ENABLE_TEST_WEBHOOKS === "true") {
          return {
            classPriceCents: 0,
            bookingFeeCents: 0,
            totalCents: 0,
            currency: "eur",
          };
        }

        const meta = input.metadata ?? {};
        const stripeAccountId = await resolveStripeAccountIdFromMetadata({
          payload: ctx.payload,
          metadata: meta,
        });
        const stripeOpts = stripeAccountId
          ? ({ stripeAccount: stripeAccountId } satisfies Stripe.RequestOptions)
          : undefined;

        const priceObj = await ctx.stripe.prices.retrieve(
          input.priceId,
          { expand: [] },
          stripeOpts
        );

        const unitAmount = priceObj.unit_amount ?? 0;
        const quantity = input.quantity || 1;
        const classPriceCents = unitAmount * quantity;

        let bookingFeeCents = 0;
        if (getFee && ctx.payload && typeof meta.tenantId === "string") {
          const tenantId = parseInt(meta.tenantId, 10);
          if (Number.isFinite(tenantId)) {
            try {
              const feeCents = await getFee({
                payload: ctx.payload,
                tenantId,
                classPriceAmountCents: classPriceCents,
                metadata: meta,
              });
              if (typeof feeCents === "number" && feeCents > 0) {
                bookingFeeCents = feeCents;
              }
            } catch (e) {
              console.warn("Subscription booking fee lookup failed", e);
            }
          }
        }

        return {
          classPriceCents,
          bookingFeeCents,
          totalCents: classPriceCents + bookingFeeCents,
          currency: (priceObj.currency ?? "eur").toLowerCase(),
        };
      }),
    /**
     * Create Stripe Checkout session (subscription or one-time).
     * When getSubscriptionBookingFeeCents was passed to createPaymentsRouter and mode is "subscription",
     * pass metadata.tenantId so a "Booking fee" line item is added to Checkout.
     */
    createCustomerCheckoutSession: stripeProtectedProcedure
    .input(
      z.object({
        priceId: z.string(),
        quantity: z.number().optional(),
        metadata: z.record(z.string(), z.string()).optional(),
        /**
         * Customer-facing promo code (e.g. SUMMER20). Resolved against tenant-scoped
         * `discount-codes` and applied as a Stripe Promotion Code.
         */
        discountCode: z.string().optional(),
        successUrl: z.string().optional(),
        cancelUrl: z.string().optional(),
        mode: z.enum(["subscription", "payment"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // E2E/CI: don't call Stripe. We only need a redirect URL to keep the booking flow deterministic.
      // Playwright config sets ENABLE_TEST_WEBHOOKS=true; using it here avoids external dependency flakes.
      if (process.env.NODE_ENV === "test" || process.env.ENABLE_TEST_WEBHOOKS === "true") {
        // Keep return type consistent with the real Stripe call so builds don't break.
        // NOTE: Stripe.Response<T> is effectively T augmented with `lastResponse`, so callers expect `session.url`.
        const redirectUrl = (() => {
          const raw =
            input.successUrl ||
            `${publicOriginFromTrpcContext(ctx)}/`;
          try {
            // Next/router.push expects an internal path; normalize absolute URLs to a pathname.
            return raw.startsWith("http") ? new URL(raw).pathname : raw;
          } catch {
            return "/";
          }
        })();

        return ({
          object: "checkout.session",
          id: `cs_test_${Date.now()}`,
          url: redirectUrl,
          lastResponse: {} as Stripe.Response<Stripe.Checkout.Session>["lastResponse"],
        } as unknown) as Stripe.Response<Stripe.Checkout.Session>;
      }

      const meta = input.metadata ?? {};
      const stripeAccountId = await resolveStripeAccountIdFromMetadata({
        payload: ctx.payload,
        metadata: meta,
      });
      const stripeOpts = stripeAccountId
        ? ({ stripeAccount: stripeAccountId } satisfies Stripe.RequestOptions)
        : undefined;

      // Optional: resolve tenant discount code → Stripe Promotion Code id.
      // NOTE: Discount codes are created on the tenant's Connect account in atnd-me.
      let promotionCodeId: string | null = null;
      const discountCodeNormalized = input.discountCode
        ? String(input.discountCode).trim().toUpperCase()
        : "";
      if (discountCodeNormalized) {
        const tenantIdRaw = meta.tenantId;
        const tenantId =
          typeof tenantIdRaw === "string" ? parseInt(tenantIdRaw, 10) : NaN;
        if (!Number.isFinite(tenantId)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "discountCode requires metadata.tenantId",
          });
        }
        if (!stripeAccountId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "discountCode requires a connected Stripe account (Connect-scoped checkout).",
          });
        }

        const match = await ctx.payload.find({
          collection: "discount-codes" as any,
          depth: 0,
          limit: 0,
          overrideAccess: true,
          where: {
            and: [
              { tenant: { equals: tenantId } },
              { status: { equals: "active" } },
              { stripePromotionCodeId: { exists: true } },
            ],
          },
        });
        const doc = (match as any)?.docs?.find(
          (row: { code?: string | null }) =>
            String(row.code ?? "")
              .trim()
              .toUpperCase() === discountCodeNormalized,
        ) as { stripePromotionCodeId?: string | null } | undefined;
        promotionCodeId =
          doc?.stripePromotionCodeId && String(doc.stripePromotionCodeId).trim()
            ? String(doc.stripePromotionCodeId).trim()
            : null;
        if (!promotionCodeId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid or inactive discount code.",
          });
        }
        meta.discountCode = discountCodeNormalized;
      }

      const payloadUser = await resolvePayloadUser({
        payload: ctx.payload,
        sessionUser: ctx.user,
      });

      let { stripeCustomerId: customerId } =
        await ensureStripeCustomerIdForAccount({
          payload: ctx.payload,
          stripe: ctx.stripe,
          userId: payloadUser.id,
          email: payloadUser.email ?? null,
          name: payloadUser.name ?? null,
          stripeAccountId,
        });

      const lineItems: Stripe.Checkout.SessionCreateParams["line_items"] = [
        { price: input.priceId, quantity: input.quantity || 1 },
      ];

      // Resolve plan/product price (cents) for gift leftover metadata — exclude platform fee.
      try {
        const priceObjForPlan = await ctx.stripe.prices.retrieve(
          input.priceId,
          { expand: [] },
          stripeOpts
        );
        const unitAmount = priceObjForPlan.unit_amount ?? 0;
        const quantity = input.quantity || 1;
        if (typeof unitAmount === "number" && unitAmount > 0) {
          const planPriceCents = unitAmount * quantity;
          meta.planPriceAmount = String(planPriceCents);
          meta.classPriceAmount = String(planPriceCents);
          // Euros string for remainder helper parity with drop-ins.
          meta.classPriceBeforeDiscount = String(
            Number((planPriceCents / 100).toFixed(2))
          );
        }
      } catch (e) {
        console.warn("Checkout plan price lookup failed", e);
      }

      // When getFee is configured, compute booking fee.
      // - Platform-scoped Checkout: add a visible "Booking fee" line item (platform charges customer directly).
      // - Connect-scoped Checkout: add the same visible line item so the customer sees/pays it,
      //   then set application_fee_percent so the platform receives that amount from the connected account.
      let connectApplicationFeePercent: number | undefined;
      if (
        input.mode === "subscription" &&
        getFee &&
        ctx.payload &&
        typeof meta.tenantId === "string"
      ) {
        const tenantId = parseInt(meta.tenantId, 10);
        if (Number.isFinite(tenantId)) {
          try {
            const priceObj = await ctx.stripe.prices.retrieve(
              input.priceId,
              { expand: [] },
              stripeOpts
            );
            const unitAmount = priceObj.unit_amount ?? 0;
            const quantity = input.quantity || 1;
            const classPriceAmountCents = unitAmount * quantity;
            const feeCents = await getFee({
              payload: ctx.payload,
              tenantId,
              classPriceAmountCents,
              metadata: meta,
            });
            if (
              typeof feeCents === "number" &&
              feeCents > 0 &&
              classPriceAmountCents > 0
            ) {
              const currency = (priceObj.currency ?? "eur").toLowerCase();
              const recurring = priceObj.recurring;
              if (!recurring) {
                throw new Error(
                  "Subscription booking fee requires a recurring plan price"
                );
              }

              if (stripeAccountId) {
                // 1) Add visible booking fee line item so customer sees/pays it in Stripe Checkout.
                lineItems.push({
                  quantity: 1,
                  price_data: {
                    currency,
                    product_data: {
                      name: "Booking fee",
                      description: "Platform booking fee",
                    },
                    unit_amount: feeCents,
                    recurring: {
                      interval: recurring.interval,
                      interval_count: recurring.interval_count ?? 1,
                    },
                  },
                });

                // 2) Set application_fee_percent so the platform receives (approximately) the booking fee
                // from the connected account's charge. Percent is based on the *total* invoice amount
                // (base + booking fee) so the connected account nets the base amount.
                const totalCents = classPriceAmountCents + feeCents;
                if (totalCents > 0) {
                  const exact = findExactApplicationFeePercent({
                    feeCents,
                    totalCents,
                  });
                  if (exact != null && exact > 0) {
                    connectApplicationFeePercent = exact;
                  } else {
                    // Fallback (should be rare): closest 2dp percent.
                    const pctRaw = (feeCents / totalCents) * 100;
                    const pct = Math.round(pctRaw * 100) / 100;
                    if (Number.isFinite(pct) && pct > 0) {
                      connectApplicationFeePercent = pct;
                    }
                  }
                }
              } else {
                lineItems.push({
                  quantity: 1,
                  price_data: {
                    currency,
                    product_data: {
                      name: "Booking fee",
                      description: "Platform booking fee",
                    },
                    unit_amount: feeCents,
                    recurring: {
                      interval: recurring.interval,
                      interval_count: recurring.interval_count ?? 1,
                    },
                  },
                });
              }
            }
          } catch (e) {
            console.warn("Subscription booking fee lookup failed", e);
          }
        }
      }

      const checkoutOrigin = publicOriginFromTrpcContext(ctx);
      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        line_items: lineItems,
        metadata: meta,
        mode: input.mode,
        customer: customerId,
        success_url:
          input.successUrl || `${checkoutOrigin}/`,
        cancel_url:
          input.cancelUrl || `${checkoutOrigin}/`,
      };
      if (promotionCodeId) {
        sessionParams.discounts = [{ promotion_code: promotionCodeId }];
      } else {
        sessionParams.allow_promotion_codes = true;
      }
      if (input.mode === "subscription") {
        sessionParams.subscription_data = {
          metadata: meta,
          ...(stripeAccountId && connectApplicationFeePercent != null
            ? { application_fee_percent: connectApplicationFeePercent }
            : {}),
        };
      }
      if (input.mode === "payment") {
        sessionParams.payment_intent_data = {
          metadata: meta,
        };
      }

      const createCheckoutSession = () =>
        ctx.stripe.checkout.sessions.create(sessionParams, stripeOpts);

      try {
        return await createCheckoutSession();
      } catch (first) {
        if (
          !stripeAccountId ||
          !isStripeMissingConnectCustomerError(first)
        ) {
          throw first;
        }
        await removeConnectCustomerMappingForAccount(
          ctx.payload,
          payloadUser.id,
          stripeAccountId
        );
        const repaired = await ensureStripeCustomerIdForAccount({
          payload: ctx.payload,
          stripe: ctx.stripe,
          userId: payloadUser.id,
          email: payloadUser.email ?? null,
          name: payloadUser.name ?? null,
          stripeAccountId,
        });
        customerId = repaired.stripeCustomerId;
        sessionParams.customer = customerId;
        return await createCheckoutSession();
      }
    }),
  createCustomerPortal: stripeProtectedProcedure
    .input(
      z
        .object({
          returnUrl: z.string().optional(),
          /** When provided, attempts to open the portal on the tenant's Connect account. */
          tenantId: z.union([z.number(), z.string()]).optional(),
        })
        .optional()
    )
    .mutation(async ({ ctx, input }) => {
      const payloadUser = await resolvePayloadUser({
        payload: ctx.payload,
        sessionUser: ctx.user,
      });
      const tenantId = coerceNumericId(input?.tenantId);
      const tenantDoc =
        tenantId != null
          ? await ctx.payload
              .findByID({
                collection: "tenants" as any,
                id: tenantId,
                depth: 0,
                overrideAccess: true,
              })
              .catch(() => null)
          : null;
      const tenantStripeAccountId =
        tenantDoc &&
        typeof (tenantDoc as any)?.stripeConnectAccountId === "string" &&
        (tenantDoc as any).stripeConnectAccountId.trim() &&
        (tenantDoc as any)?.stripeConnectOnboardingStatus === "active"
          ? String((tenantDoc as any).stripeConnectAccountId).trim()
          : null;

      const stripeOpts = tenantStripeAccountId
        ? ({ stripeAccount: tenantStripeAccountId } satisfies Stripe.RequestOptions)
        : undefined;

      const { stripeCustomerId: customerId } = await ensureStripeCustomerIdForAccount(
        {
          payload: ctx.payload,
          stripe: ctx.stripe,
          userId: payloadUser.id,
          email: payloadUser.email ?? null,
          name: payloadUser.name ?? null,
          stripeAccountId: tenantStripeAccountId,
        }
      );
      const returnUrl =
        input?.returnUrl ||
        `${publicOriginFromTrpcContext(ctx)}/`;

      const session = await ctx.stripe.billingPortal.sessions.create(
        {
          customer: customerId,
          return_url: returnUrl,
        },
        stripeOpts
      );

      return session;
    }),
  /**
   * Preview the prorated charge for upgrading to a plan (Stripe invoice.createPreview).
   * Returns amount + timing so the confirm modal can show exactly what will be charged and when.
   */
  previewSubscriptionUpgrade: stripeProtectedProcedure
    .use(requireCollections("plans", "subscriptions"))
    .input(
      z
        .object({
          productId: z.string().optional(),
          planId: z.union([z.number(), z.string()]).optional(),
        })
        .refine((v) => Boolean(v.productId || v.planId), {
          message: "Either productId or planId is required",
        }),
    )
    .query(async ({ ctx, input }) => {
      if (process.env.NODE_ENV === "test" || process.env.ENABLE_TEST_WEBHOOKS === "true") {
        const prorationDate = Math.floor(Date.now() / 1000);
        return {
          amountDueCents: 1500,
          prorationCents: 1500,
          chargeAmountCents: 1500,
          chargeTiming: "immediate" as const,
          currency: "eur",
          prorationDate,
          nextPeriodEndUnix: prorationDate + 30 * 24 * 60 * 60,
          recurringTotalCents: 5200,
          prorationBehavior: "always_invoice" as const,
        };
      }

      const upgradeCtx = await resolveCustomerSubscriptionUpgradeContext({
        payload: ctx.payload,
        stripe: ctx.stripe,
        sessionUser: ctx.user,
        productId: input.productId,
        planId: input.planId,
      });

      const liveSubscription = await ctx.stripe.subscriptions.retrieve(
        upgradeCtx.stripeSubscriptionId,
        { expand: ["items.data.price.product"] },
        upgradeCtx.stripeOpts,
      );
      const subscriptionItems = liveSubscription.items?.data ?? [];

      const built = await buildUpgradeSubscriptionItemUpdates({
        stripe: ctx.stripe,
        stripeOpts: upgradeCtx.stripeOpts,
        subscriptionItems,
        priceId: upgradeCtx.priceId,
        planTenantId: upgradeCtx.planTenantId,
        payload: ctx.payload,
        getFee,
      });

      const prorationDate = Math.floor(Date.now() / 1000);

      const preview = await ctx.stripe.invoices.createPreview(
        {
          customer: upgradeCtx.customerId,
          subscription: upgradeCtx.stripeSubscriptionId,
          subscription_details: {
            items: built.itemUpdates,
            proration_behavior: built.prorationBehavior,
            proration_date: prorationDate,
          },
        },
        upgradeCtx.stripeOpts,
      );

      const lines = (preview.lines?.data ?? []).map((line) => ({
        amount: typeof line.amount === "number" ? line.amount : 0,
        proration: Boolean((line as { proration?: boolean }).proration),
        periodStart:
          typeof line.period?.start === "number" ? line.period.start : null,
      }));

      const amountDueCents =
        typeof preview.amount_due === "number" ? preview.amount_due : 0;
      const prorationCents = sumProrationLineCents({
        lines,
        prorationDate,
      });
      const chargeAmountCents = resolveUpgradeChargeAmountCents({
        prorationBehavior: built.prorationBehavior,
        amountDueCents,
        prorationCents,
      });
      const chargeTiming = resolveUpgradeChargeTiming({
        prorationBehavior: built.prorationBehavior,
        chargeAmountCents,
      });

      const nextPeriodEndUnix =
        typeof liveSubscription.current_period_end === "number"
          ? liveSubscription.current_period_end
          : typeof preview.period_end === "number"
            ? preview.period_end
            : null;

      const recurringTotalCents = built.unitAmount + built.bookingFeeCents;

      return {
        amountDueCents,
        prorationCents,
        chargeAmountCents,
        chargeTiming,
        currency: (preview.currency || built.currency || "eur").toLowerCase(),
        prorationDate,
        nextPeriodEndUnix,
        recurringTotalCents,
        prorationBehavior: built.prorationBehavior,
      };
    }),
  createCustomerUpgradePortal: stripeProtectedProcedure
    .use(requireCollections("plans", "subscriptions"))
    .input(
      z.object({
        /**
         * Back-compat: historically clients passed Stripe Product ID (plan.stripeProductId).
         * Some apps restrict querying `stripeProductId` via field-level access, so we also accept
         * `planId` (Payload doc id) to avoid querying by protected fields.
         */
        productId: z.string().optional(),
        planId: z.union([z.number(), z.string()]).optional(),
        returnUrl: z.string().optional(),
        /**
         * Unix timestamp from previewSubscriptionUpgrade so Stripe calculates
         * the same prorations as the confirm modal showed.
         */
        prorationDate: z.number().int().positive().optional(),
      })
      .refine((v) => Boolean(v.productId || v.planId), {
        message: "Either productId or planId is required",
      })
    )
    .mutation(async ({ ctx, input }) => {
      const {
        priceId,
        stripeProductId,
        customerId,
        stripeSubscriptionId,
        stripeOpts,
        planTenantId,
      } = await resolveCustomerSubscriptionUpgradeContext({
        payload: ctx.payload,
        stripe: ctx.stripe,
        sessionUser: ctx.user,
        productId: input.productId,
        planId: input.planId,
      });

      const returnUrl =
        input.returnUrl || `${publicOriginFromTrpcContext(ctx)}/`;

      const withUpgradeQuery = (raw: string, mode: "portal" | "invoice" | "direct") => {
        try {
          const url = new URL(
            raw.startsWith("http") ? raw : `http://localhost:3000${raw.startsWith("/") ? raw : `/${raw}`}`,
          );
          url.searchParams.set("subscription_upgraded", "1");
          url.searchParams.set("upgrade_via", mode);
          return raw.startsWith("http") ? url.toString() : `${url.pathname}${url.search}`;
        } catch {
          return raw;
        }
      };

      if (process.env.NODE_ENV === "test" || process.env.ENABLE_TEST_WEBHOOKS === "true") {
        const redirectUrl = (() => {
          try {
            const url = new URL(
              returnUrl.startsWith("http")
                ? returnUrl
                : `http://localhost:3000${returnUrl.startsWith("/") ? returnUrl : `/${returnUrl}`}`,
            );
            url.searchParams.set("test_stripe_portal", "upgrade");
            url.searchParams.set("subscription", stripeSubscriptionId);
            return `${url.pathname}${url.search}`;
          } catch {
            return "/?test_stripe_portal=upgrade";
          }
        })();

        return ({
          object: "billing_portal.session",
          id: `bps_test_${Date.now()}`,
          url: redirectUrl,
          lastResponse: {} as Stripe.Response<Stripe.BillingPortal.Session>["lastResponse"],
        } as unknown) as Stripe.Response<Stripe.BillingPortal.Session>;
      }

      // Connect checkout adds a recurring "Platform fee" line item. Stripe Billing Portal
      // cannot run subscription_update on multi-item subscriptions — upgrade via API instead
      // and send the customer to the hosted invoice when payment is due.
      const liveSubscription = await ctx.stripe.subscriptions.retrieve(
        stripeSubscriptionId,
        { expand: ["items.data.price.product"] },
        stripeOpts,
      );
      const subscriptionItems = liveSubscription.items?.data ?? [];

      if (subscriptionItems.length > 1) {
        const built = await buildUpgradeSubscriptionItemUpdates({
          stripe: ctx.stripe,
          stripeOpts,
          subscriptionItems,
          priceId,
          planTenantId,
          payload: ctx.payload,
          getFee,
        });

        const totalCents = built.unitAmount + built.bookingFeeCents;
        const exactPct =
          built.bookingFeeCents > 0
            ? findExactApplicationFeePercent({
                feeCents: built.bookingFeeCents,
                totalCents,
              })
            : null;
        const applicationFeePercent =
          exactPct != null && exactPct > 0
            ? exactPct
            : built.bookingFeeCents > 0 && totalCents > 0
              ? Math.round((built.bookingFeeCents / totalCents) * 10000) / 100
              : undefined;

        const upgradeMetadata = {
          ...(liveSubscription.metadata ?? {}),
          tenantId:
            planTenantId != null
              ? String(planTenantId)
              : (liveSubscription.metadata?.tenantId ?? ""),
          planPriceAmount: String(built.unitAmount),
          bookingFeeAmount: String(built.bookingFeeCents),
        };

        // pending_if_incomplete does not allow application_fee_percent — set the fee
        // first so the upgrade invoice uses the correct Connect take.
        if (typeof applicationFeePercent === "number" && applicationFeePercent > 0) {
          await ctx.stripe.subscriptions.update(
            stripeSubscriptionId,
            {
              application_fee_percent: applicationFeePercent,
              metadata: upgradeMetadata,
            },
            stripeOpts,
          );
        }

        const updated = await ctx.stripe.subscriptions.update(
          stripeSubscriptionId,
          {
            items: built.itemUpdates,
            proration_behavior: "always_invoice",
            ...(typeof input.prorationDate === "number"
              ? { proration_date: input.prorationDate }
              : {}),
            payment_behavior: "pending_if_incomplete",
            expand: ["latest_invoice"],
            metadata: upgradeMetadata,
          },
          stripeOpts,
        );

        const latestInvoice = updated.latest_invoice;
        const invoiceObj =
          latestInvoice && typeof latestInvoice === "object"
            ? (latestInvoice as Stripe.Invoice)
            : null;
        const hostedInvoiceUrl =
          invoiceObj &&
          typeof invoiceObj.hosted_invoice_url === "string" &&
          invoiceObj.hosted_invoice_url.trim() &&
          (invoiceObj.status === "open" || invoiceObj.status === "draft")
            ? invoiceObj.hosted_invoice_url.trim()
            : null;

        const redirectUrl = hostedInvoiceUrl ?? withUpgradeQuery(returnUrl, "direct");

        return ({
          object: "billing_portal.session",
          id: `bps_multi_item_upgrade_${Date.now()}`,
          url: redirectUrl,
          lastResponse: {} as Stripe.Response<Stripe.BillingPortal.Session>["lastResponse"],
        } as unknown) as Stripe.Response<Stripe.BillingPortal.Session>;
      }

      const newConfig = await ctx.stripe.billingPortal.configurations.create(
        {
          business_profile: {
            headline: "Manage your subscription",
          },
          features: {
            payment_method_update: {
              enabled: true,
            },
            subscription_update: {
              enabled: true,
              default_allowed_updates: ["price"],
              proration_behavior: "create_prorations",
              products: [
                {
                  product: stripeProductId,
                  prices: [priceId],
                },
              ],
            },
            customer_update: {
              enabled: true,
              allowed_updates: ["email", "address"],
            },
            invoice_history: { enabled: true },
          },
        },
        stripeOpts
      );

      const session = await ctx.stripe.billingPortal.sessions.create(
        {
          customer: customerId,
          configuration: newConfig.id,
          return_url: returnUrl,
          flow_data: {
            type: "subscription_update",
            subscription_update: {
              subscription: stripeSubscriptionId,
            },
          },
        },
        stripeOpts
      );

      return session;
    }),
  /**
   * Creates a payment intent for one-time payments (e.g., drop-ins)
   */
  createPaymentIntent: stripeProtectedProcedure
    .use(requireCollections("users"))
    .input(
      z.object({
        amount: z.number(),
        metadata: z.record(z.string(), z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { user, stripe } = ctx;
      const { amount, metadata } = input;

      // Get user details to access email and customer ID
      const userDoc = await findSafe(ctx.payload, "users", {
        where: {
          id: { equals: user.id },
        },
        limit: 1,
        overrideAccess: true,
      });

      if (userDoc.docs.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      const userData = userDoc.docs[0] as any;

      // Format amount for Stripe (convert to cents)
      const amountInCents = Math.round(amount * 100);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        automatic_payment_methods: { enabled: true },
        currency: "eur",
        receipt_email: userData.email,
        customer: userData.stripeCustomerId || undefined,
        metadata: metadata,
      });

      return {
        clientSecret: paymentIntent.client_secret as string,
        amount: amount,
      };
    }),
  };
}
