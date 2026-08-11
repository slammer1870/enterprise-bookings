import type { CollectionAfterChangeHook, Payload } from "payload";
import {
  formatCancelRefundMessage,
  getCancelRefundPreview,
  shouldRefundOnCancel,
  type CancelPaymentMethod,
  type TenantRefundPolicy,
} from "./refund-policy";

type BookingLike = {
  id: number;
  status?: string;
  timeslot?: number | { id?: number; startTime?: string | Date } | null;
  tenant?: number | { id?: number } | null;
};

type TransactionLike = {
  id: number;
  paymentMethod?: CancelPaymentMethod;
  classPassId?: number | null;
  stripePaymentIntentId?: string | null;
  refundedAt?: string | null;
  stripeRefundId?: string | null;
  classPassRestoredAt?: string | null;
  dropInId?: number | null;
};

export type RefundStripePaymentIntentArgs = {
  paymentIntentId: string;
  /**
   * When > 0, refund exactly this many cents.
   * When 0, the callback should retrieve the PaymentIntent amount and use
   * siblingCount / alreadyRefundedCount with computePartialRefundAmountCents.
   */
  amountCents: number;
  siblingCount: number;
  alreadyRefundedCount: number;
  /** Connected account id when the PI lives on the Connect account (direct charge). */
  stripeAccountId?: string | null;
};

export type ApplyCancelRefundPolicyOptions = {
  payload: Payload;
  booking: BookingLike;
  /**
   * Optional Stripe refund callback. When omitted, Stripe refunds are skipped
   * (class-pass restore still runs).
   */
  refundStripePaymentIntent?: (
    _args: RefundStripePaymentIntentArgs,
  ) => Promise<{ refundId?: string | null } | void>;
  /** Override "now" for tests. */
  now?: Date;
};

export type ApplyCancelRefundPolicyResult = {
  applied: boolean;
  kind: "stripe" | "class_pass" | "none";
  reason?: string;
};

function relationId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "object" && value != null && "id" in value) {
    const id = (value as { id?: unknown }).id;
    if (typeof id === "number" && Number.isFinite(id)) return id;
  }
  return null;
}

async function loadTimeslotStart(
  payload: Payload,
  booking: BookingLike,
): Promise<Date | string | null> {
  const nested =
    typeof booking.timeslot === "object" && booking.timeslot != null
      ? booking.timeslot.startTime
      : null;
  if (nested != null) return nested;

  const timeslotId = relationId(booking.timeslot);
  if (timeslotId == null) return null;

  const timeslot = (await payload.findByID({
    collection: "timeslots" as any,
    id: timeslotId,
    depth: 0,
    overrideAccess: true,
  })) as { startTime?: string | Date } | null;

  return timeslot?.startTime ?? null;
}

async function loadTenantPolicy(
  payload: Payload,
  booking: BookingLike,
): Promise<{ policy: TenantRefundPolicy; stripeAccountId: string | null }> {
  let tenantId = relationId(booking.tenant);
  if (tenantId == null) {
    const timeslotId = relationId(booking.timeslot);
    if (timeslotId != null) {
      const timeslot = (await payload.findByID({
        collection: "timeslots" as any,
        id: timeslotId,
        depth: 0,
        overrideAccess: true,
      })) as { tenant?: unknown } | null;
      tenantId = relationId(timeslot?.tenant);
    }
  }

  if (tenantId == null) {
    return { policy: null, stripeAccountId: null };
  }

  const tenant = (await payload.findByID({
    collection: "tenants" as any,
    id: tenantId,
    depth: 0,
    overrideAccess: true,
  })) as {
    refundPolicy?: TenantRefundPolicy;
    stripeConnectAccountId?: string | null;
    stripeConnectOnboardingStatus?: string | null;
  } | null;

  const stripeAccountId =
    tenant &&
    typeof tenant.stripeConnectAccountId === "string" &&
    tenant.stripeConnectAccountId.trim() &&
    tenant.stripeConnectOnboardingStatus === "active"
      ? tenant.stripeConnectAccountId.trim()
      : null;

  return { policy: tenant?.refundPolicy ?? null, stripeAccountId };
}

async function loadBookingTransaction(
  payload: Payload,
  bookingId: number,
): Promise<TransactionLike | null> {
  const result = await payload.find({
    collection: "transactions" as any,
    where: { booking: { equals: bookingId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  return (result.docs[0] as TransactionLike | undefined) ?? null;
}

/**
 * Compute this booking's share of a shared PaymentIntent for partial refunds.
 * Last unrefunded sibling receives the remainder to avoid rounding drift.
 */
export function computePartialRefundAmountCents(opts: {
  paymentIntentAmountCents: number;
  siblingCount: number;
  alreadyRefundedCount: number;
}): number {
  const total = Math.max(0, Math.trunc(opts.paymentIntentAmountCents));
  const siblings = Math.max(1, Math.trunc(opts.siblingCount));
  const already = Math.max(0, Math.trunc(opts.alreadyRefundedCount));
  const share = Math.floor(total / siblings);
  const remainingSiblings = siblings - already;
  if (remainingSiblings <= 1) {
    return Math.max(0, total - share * (siblings - 1));
  }
  return share;
}

async function restoreClassPassCredit(
  payload: Payload,
  tx: TransactionLike,
): Promise<void> {
  if (tx.classPassRestoredAt) return;
  const passId = tx.classPassId;
  if (passId == null) return;

  const pass = (await payload.findByID({
    collection: "class-passes" as any,
    id: passId,
    depth: 0,
    overrideAccess: true,
  })) as { quantity?: number; status?: string } | null;
  if (!pass || typeof pass.quantity !== "number") return;

  const nextQty = pass.quantity + 1;
  const status = nextQty > 0 ? "active" : (pass.status ?? "used");
  await payload.update({
    collection: "class-passes" as any,
    id: passId,
    data: { quantity: nextQty, status } as Record<string, unknown>,
    overrideAccess: true,
  });

  await payload.update({
    collection: "transactions" as any,
    id: tx.id,
    data: { classPassRestoredAt: new Date().toISOString() } as Record<string, unknown>,
    overrideAccess: true,
  });
}

async function refundStripeForTransaction(
  payload: Payload,
  tx: TransactionLike,
  stripeAccountId: string | null,
  refundStripePaymentIntent: NonNullable<
    ApplyCancelRefundPolicyOptions["refundStripePaymentIntent"]
  >,
): Promise<void> {
  if (tx.refundedAt || tx.stripeRefundId) return;
  const paymentIntentId =
    typeof tx.stripePaymentIntentId === "string" ? tx.stripePaymentIntentId.trim() : "";
  if (!paymentIntentId) return;

  const siblings = await payload.find({
    collection: "transactions" as any,
    where: {
      and: [
        { paymentMethod: { equals: "stripe" } },
        { stripePaymentIntentId: { equals: paymentIntentId } },
      ],
    },
    limit: 100,
    depth: 0,
    overrideAccess: true,
  });

  const siblingDocs = siblings.docs as TransactionLike[];
  const siblingCount = Math.max(1, siblingDocs.length);
  const alreadyRefundedCount = siblingDocs.filter(
    (s) => s.id !== tx.id && (s.refundedAt || s.stripeRefundId),
  ).length;

  const result = await refundStripePaymentIntent({
    paymentIntentId,
    // 0 => callback retrieves PI amount and computes partial share
    amountCents: 0,
    siblingCount,
    alreadyRefundedCount,
    stripeAccountId,
  });

  const refundId =
    result && typeof result === "object" && typeof result.refundId === "string"
      ? result.refundId
      : null;

  await payload.update({
    collection: "transactions" as any,
    id: tx.id,
    data: {
      refundedAt: new Date().toISOString(),
      ...(refundId ? { stripeRefundId: refundId } : {}),
    } as Record<string, unknown>,
    overrideAccess: true,
  });
}

/**
 * Apply tenant refund policy after a confirmed booking is cancelled.
 * Always safe to call: no-ops when outside window / unset policy / already applied.
 */
export async function applyCancelRefundPolicy(
  opts: ApplyCancelRefundPolicyOptions,
): Promise<ApplyCancelRefundPolicyResult> {
  const { payload, booking, refundStripePaymentIntent, now } = opts;

  if (booking.status !== "cancelled") {
    return { applied: false, kind: "none", reason: "not_cancelled" };
  }

  const timeslotStart = await loadTimeslotStart(payload, booking);
  if (timeslotStart == null) {
    return { applied: false, kind: "none", reason: "missing_timeslot_start" };
  }

  const tx = await loadBookingTransaction(payload, booking.id);
  if (!tx) {
    return { applied: false, kind: "none", reason: "missing_transaction" };
  }

  const paymentMethod = (tx.paymentMethod ?? null) as CancelPaymentMethod;
  const { policy, stripeAccountId } = await loadTenantPolicy(payload, booking);

  if (
    !shouldRefundOnCancel({
      policy,
      paymentMethod,
      timeslotStart,
      now,
    })
  ) {
    return { applied: false, kind: "none", reason: "outside_policy" };
  }

  if (paymentMethod === "class_pass") {
    await restoreClassPassCredit(payload, tx);
    return { applied: true, kind: "class_pass" };
  }

  if (paymentMethod === "stripe") {
    if (!refundStripePaymentIntent) {
      return { applied: false, kind: "none", reason: "missing_stripe_refund_callback" };
    }
    await refundStripeForTransaction(
      payload,
      tx,
      stripeAccountId,
      refundStripePaymentIntent,
    );
    return { applied: true, kind: "stripe" };
  }

  return { applied: false, kind: "none", reason: "unsupported_payment_method" };
}

export type CreateApplyRefundPolicyOnCancelHookOptions = {
  refundStripePaymentIntent?: ApplyCancelRefundPolicyOptions["refundStripePaymentIntent"];
};

/**
 * Bookings afterChange hook: when status moves confirmed → cancelled, apply refund policy.
 */
export function createApplyRefundPolicyOnCancelHook(
  options: CreateApplyRefundPolicyOnCancelHookOptions = {},
): CollectionAfterChangeHook {
  const { refundStripePaymentIntent } = options;
  return async ({ doc, previousDoc, req, context }) => {
    if (context?.triggerAfterChange === false) return;
    if (context?.skipRefundPolicy === true) return;
    if (context?.skipBookingSideEffects === true) return;
    if (previousDoc?.status !== "confirmed") return;
    if (doc?.status !== "cancelled") return;

    try {
      await applyCancelRefundPolicy({
        payload: req.payload,
        booking: doc as BookingLike,
        refundStripePaymentIntent,
      });
    } catch (err) {
      // Do not fail the cancel mutation if refund/restore fails; log for ops.
      req.payload.logger?.error?.(
        {
          err,
          bookingId: (doc as { id?: number })?.id,
        },
        "applyCancelRefundPolicy failed",
      );
    }
  };
}

export async function previewCancelRefundForBooking(opts: {
  payload: Payload;
  bookingId: number;
  now?: Date;
}): Promise<{
  willRefund: boolean;
  kind: "stripe" | "class_pass" | "none";
  windowHours: number | null;
  message: string;
}> {
  const booking = (await opts.payload.findByID({
    collection: "bookings" as any,
    id: opts.bookingId,
    depth: 1,
    overrideAccess: true,
  })) as BookingLike | null;

  if (!booking) {
    return {
      willRefund: false,
      kind: "none",
      windowHours: null,
      message: formatCancelRefundMessage({ willRefund: false, kind: "none" }),
    };
  }

  const timeslotStart = await loadTimeslotStart(opts.payload, booking);
  const tx = await loadBookingTransaction(opts.payload, booking.id);
  const paymentMethod = (tx?.paymentMethod ?? null) as CancelPaymentMethod;
  const { policy } = await loadTenantPolicy(opts.payload, booking);

  const preview = getCancelRefundPreview({
    policy,
    paymentMethod,
    timeslotStart: timeslotStart ?? new Date(0).toISOString(),
    now: opts.now,
  });

  return {
    ...preview,
    message: formatCancelRefundMessage(preview),
  };
}
