import { z } from "zod";

import {
  stripeProtectedProcedure,
  protectedProcedure,
  requireBookingCollections,
  requireCollections,
  type GetSubscriptionBookingFeeCents,
} from "../trpc";
import { findSafe } from "../utils/collections";
import { TRPCError } from "@trpc/server";
import Stripe from "stripe";

export type GetDropInFeeBreakdown = (_params: {
  payload: any;
  lessonId: number;
  classPriceCents: number;
  originalClassPriceCents?: number;
  promoDiscountCents?: number;
}) => Promise<{
  classPriceCents: number;
  originalClassPriceCents?: number;
  promoDiscountCents?: number;
  bookingFeeCents: number;
  totalCents: number;
}>;

export type CreatePaymentsRouterDeps = {
  getSubscriptionBookingFeeCents?: GetSubscriptionBookingFeeCents;
  getDropInFeeBreakdown?: GetDropInFeeBreakdown;
};

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

/**
 * Stripe Checkout for subscriptions only accepts application_fee_percent (2 decimal places).
 * We can still get *exact cents* by picking basis points that round to the desired amount for a known total.
 *
 * Returns percent with 2dp (e.g. 1.25) or null if no exact value exists.
 */
function findExactApplicationFeePercent(params: {
  feeCents: number;
  totalCents: number;
}): number | null {
  const { feeCents, totalCents } = params;
  if (!Number.isFinite(feeCents) || !Number.isFinite(totalCents)) return null;
  if (feeCents <= 0 || totalCents <= 0) return null;

  // basis points (2dp): 1bp = 0.01%
  // Want: round(totalCents * bp / 10000) == feeCents
  // Use integer math with strict upper bound to avoid float issues:
  // (2*feeCents - 1)*10000 <= 2*totalCents*bp < (2*feeCents + 1)*10000
  const twoT = 2 * totalCents;
  const lower = (2 * feeCents - 1) * 10000;
  const upperExclusive = (2 * feeCents + 1) * 10000;

  const bpMin = Math.ceil(lower / twoT);
  const bpMax = Math.floor((upperExclusive - 1) / twoT);

  const min = Math.max(0, bpMin);
  const max = Math.min(10000, bpMax);
  if (min > max) return null;

  const target = Math.round((feeCents / totalCents) * 10000);
  const bp = Math.min(max, Math.max(min, target));

  // Final sanity check (match Math.round used by Stripe for currency rounding).
  const computed = Math.round((totalCents * bp) / 10000);
  if (computed !== feeCents) return null;
  return bp / 100;
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

export function createPaymentsRouter(deps?: CreatePaymentsRouterDeps) {
  const getFee = deps?.getSubscriptionBookingFeeCents;
  const getDropInFeeBreakdown = deps?.getDropInFeeBreakdown;

  return {
    ...(getDropInFeeBreakdown && {
      /**
       * Returns fee breakdown for drop-in checkout (class price, booking fee, total).
       */
      getDropInFeeBreakdown: protectedProcedure
        .use(requireBookingCollections("lessons"))
        .use(requireCollections("tenants"))
        .input(
          z.object({
            lessonId: z.number(),
            classPriceCents: z.number().min(0),
            originalClassPriceCents: z.number().min(0).optional(),
            promoDiscountCents: z.number().min(0).optional(),
          })
        )
        .query(({ ctx, input }) =>
          getDropInFeeBreakdown({
            payload: ctx.payload,
            lessonId: input.lessonId,
            classPriceCents: input.classPriceCents,
            originalClassPriceCents: input.originalClassPriceCents,
            promoDiscountCents: input.promoDiscountCents,
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
            `${process.env.NEXT_PUBLIC_SERVER_URL}/`;
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
      if (input.discountCode) {
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

        const code = String(input.discountCode).trim().toUpperCase();
        const match = await ctx.payload.find({
          collection: "discount-codes" as any,
          depth: 0,
          limit: 1,
          overrideAccess: true,
          where: {
            and: [
              { tenant: { equals: tenantId } },
              { code: { equals: code } },
              { status: { equals: "active" } },
              { stripePromotionCodeId: { exists: true } },
            ],
          },
        });
        const doc = (match as any)?.docs?.[0] as
          | { stripePromotionCodeId?: string | null }
          | undefined;
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
      }

      const payloadUser = await resolvePayloadUser({
        payload: ctx.payload,
        sessionUser: ctx.user,
      });

      const { stripeCustomerId: customerId } =
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

      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        line_items: lineItems,
        metadata: meta,
        mode: input.mode,
        customer: customerId,
        success_url:
          input.successUrl || `${process.env.NEXT_PUBLIC_SERVER_URL}/`,
        cancel_url:
          input.cancelUrl || `${process.env.NEXT_PUBLIC_SERVER_URL}/`,
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
      const session = await ctx.stripe.checkout.sessions.create(
        sessionParams,
        stripeOpts
      );

      return session;
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
        `${process.env.NEXT_PUBLIC_SERVER_URL}/`;

      const session = await ctx.stripe.billingPortal.sessions.create(
        {
          customer: customerId,
          return_url: returnUrl,
        },
        stripeOpts
      );

      return session;
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
      })
      .refine((v) => Boolean(v.productId || v.planId), {
        message: "Either productId or planId is required",
      })
    )
    .mutation(async ({ ctx, input }) => {
      const parsePriceId = (plan: any): string => {
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
      };

      const resolvePlanId = (raw: unknown): number | string | null => {
        const n = coerceNumericId(raw);
        if (n != null) return n;
        if (typeof raw === "string" && raw.trim()) return raw.trim();
        return null;
      };

      let plan: any | null = null;

      // Preferred: resolve by Payload plan id (avoids querying protected fields).
      if (input.planId != null) {
        const id = resolvePlanId(input.planId);
        if (id == null) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid planId" });
        }

        // Enforce doc-level access for the caller.
        try {
          await ctx.payload.findByID({
            collection: "plans" as any,
            id,
            depth: 0,
            overrideAccess: false,
            user: ctx.user,
          });
        } catch (err: any) {
          const status = err?.statusCode;
          if (status === 403) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Not allowed" });
          }
          if (status === 404 || err?.message?.includes("not found")) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Plan not found" });
          }
          throw err;
        }

        // Privileged read for protected fields (stripeProductId / priceJSON).
        plan = await ctx.payload
          .findByID({
            collection: "plans" as any,
            id,
            depth: 0,
            overrideAccess: true,
          })
          .catch(() => null);
      } else if (input.productId) {
        // Back-compat: resolve plan by Stripe product id using privileged query, then verify doc-level access.
        const productId = input.productId;
        const found = await findSafe(ctx.payload, "plans", {
          where: { stripeProductId: { equals: productId } },
          depth: 0,
          limit: 1,
          overrideAccess: true,
        });

        plan = found?.docs?.[0] ?? null;

        if (plan?.id != null) {
          try {
            await ctx.payload.findByID({
              collection: "plans" as any,
              id: plan.id,
              depth: 0,
              overrideAccess: false,
              user: ctx.user,
            });
          } catch (err: any) {
            const status = err?.statusCode;
            if (status === 403) {
              throw new TRPCError({ code: "FORBIDDEN", message: "Not allowed" });
            }
            // If access is denied for other reasons, don't leak existence.
            if (status === 404 || err?.message?.includes("not found")) {
              throw new TRPCError({ code: "NOT_FOUND", message: "Plan not found" });
            }
            throw err;
          }
        }
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

      const priceId = parsePriceId(plan);

      const payloadUser = await resolvePayloadUser({
        payload: ctx.payload,
        sessionUser: ctx.user,
      });
      const planTenantId =
        typeof plan?.tenant === "object" && plan.tenant != null && "id" in plan.tenant
          ? coerceNumericId((plan.tenant as any).id)
          : coerceNumericId(plan?.tenant);

      // Resolve the user's current subscription via Payload (Connect-aware),
      // then use Stripe only to open the billing portal session.
      const activeOrTrialing = await findSafe<any>(ctx.payload, "subscriptions", {
        where: {
          user: { equals: payloadUser.id },
          status: { in: ["active", "trialing"] },
          ...(planTenantId != null ? { tenant: { equals: planTenantId } } : {}),
        },
        limit: 1,
        depth: 0,
        overrideAccess: false,
        user: ctx.user,
        sort: "-createdAt",
      });

      const fallbackPastDue = async () => {
        const past = await findSafe<any>(ctx.payload, "subscriptions", {
          where: {
            user: { equals: payloadUser.id },
            status: { in: ["past_due", "unpaid"] },
            ...(planTenantId != null ? { tenant: { equals: planTenantId } } : {}),
          },
          limit: 1,
          depth: 0,
          overrideAccess: false,
          user: ctx.user,
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

      // Privileged read to access Stripe IDs (field-level access is admin-only).
      const subscriptionDoc = await ctx.payload
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

      // If the subscription doc doesn't have Connect scoping info (older data),
      // fall back to the plan's tenant Connect account so we open the portal in the right scope
      // for Connect-scoped products/prices.
      const tenantDoc =
        planTenantId != null
          ? await ctx.payload
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

      // Prefer customer id captured on Connect subscription docs; otherwise resolve/create on the right scope.
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
            payload: ctx.payload,
            stripe: ctx.stripe,
            userId: payloadUser.id,
            email: payloadUser.email ?? null,
            name: payloadUser.name ?? null,
            stripeAccountId: stripeAccountIdForPortal,
          })
        ).stripeCustomerId;

      // Prefer Stripe subscription id captured in Payload; fall back to Stripe list.
      let stripeSubscriptionId =
        typeof (subscriptionDoc as any)?.stripeSubscriptionId === "string" &&
        (subscriptionDoc as any).stripeSubscriptionId.trim()
          ? (subscriptionDoc as any).stripeSubscriptionId.trim()
          : null;

      if (!stripeSubscriptionId) {
        if (process.env.NODE_ENV === "test" || process.env.ENABLE_TEST_WEBHOOKS === "true") {
          stripeSubscriptionId = `sub_test_upgrade_${subscriptionId}`;
        } else {
        const list = await ctx.stripe.subscriptions.list(
          {
            customer: customerId,
            limit: 5,
            status: "all",
          },
          stripeOpts
        );
        const candidate =
          list.data.find(
            (s) =>
              s.status === "active" ||
              s.status === "trialing" ||
              s.status === "past_due" ||
              s.status === "unpaid"
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

      if (process.env.NODE_ENV === "test" || process.env.ENABLE_TEST_WEBHOOKS === "true") {
        const redirectUrl = (() => {
          const raw = input.returnUrl || `${process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000"}/`;
          try {
            const url = new URL(raw.startsWith("http") ? raw : `http://localhost:3000${raw.startsWith("/") ? raw : `/${raw}`}`);
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

      let configId: string | undefined;

      // Create a new configuration if none exist
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

      configId = newConfig.id;
      console.log(`Created new configuration: ${configId}`);

      const returnUrl =
        input.returnUrl || `${process.env.NEXT_PUBLIC_SERVER_URL}/`;
      const session = await ctx.stripe.billingPortal.sessions.create(
        {
          customer: customerId,
          configuration: configId,
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
        overrideAccess: false,
        user: user,
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
