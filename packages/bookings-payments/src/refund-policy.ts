export type RefundPolicyMode = "inherit" | "custom" | "never";

export type RefundMethodOverride = {
  mode?: RefundPolicyMode | null;
  windowHours?: number | null;
};

export type TenantRefundPolicy = {
  defaultWindowHours?: number | null;
  advanced?: {
    dropIn?: RefundMethodOverride | null;
    classPass?: RefundMethodOverride | null;
  } | null;
} | null;

export type CancelPaymentMethod = "stripe" | "class_pass" | "subscription" | null;

export type CancelRefundKind = "stripe" | "class_pass" | "none";

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/**
 * Resolve effective free-cancellation hours for a payment method.
 * `null` means no automatic refund / credit restore.
 */
export function resolveRefundWindowHours(opts: {
  defaultWindowHours?: number | null;
  override?: RefundMethodOverride | null;
}): number | null {
  const mode = opts.override?.mode ?? "inherit";
  if (mode === "never") return null;
  if (mode === "custom") {
    const h = asFiniteNumber(opts.override?.windowHours);
    if (h == null || h < 0) return null;
    return h;
  }
  const d = asFiniteNumber(opts.defaultWindowHours);
  if (d == null || d < 0) return null;
  return d;
}

export function getMethodOverride(
  policy: TenantRefundPolicy,
  paymentMethod: CancelPaymentMethod,
): RefundMethodOverride | null {
  if (paymentMethod === "stripe") return policy?.advanced?.dropIn ?? null;
  if (paymentMethod === "class_pass") return policy?.advanced?.classPass ?? null;
  return null;
}

export function isWithinRefundWindow(opts: {
  refundWindowHours: number | null | undefined;
  timeslotStart: Date | string;
  now?: Date;
}): boolean {
  const hours = asFiniteNumber(opts.refundWindowHours);
  if (hours == null || hours < 0) return false;

  const start =
    opts.timeslotStart instanceof Date
      ? opts.timeslotStart
      : new Date(opts.timeslotStart);
  const startMs = start.getTime();
  if (!Number.isFinite(startMs)) return false;

  const nowMs = (opts.now ?? new Date()).getTime();
  const deadlineMs = startMs - hours * 60 * 60 * 1000;
  return nowMs <= deadlineMs;
}

export function shouldRefundOnCancel(opts: {
  policy: TenantRefundPolicy;
  paymentMethod: CancelPaymentMethod;
  timeslotStart: Date | string;
  now?: Date;
}): boolean {
  if (opts.paymentMethod !== "stripe" && opts.paymentMethod !== "class_pass") {
    return false;
  }
  const hours = resolveRefundWindowHours({
    defaultWindowHours: opts.policy?.defaultWindowHours,
    override: getMethodOverride(opts.policy, opts.paymentMethod),
  });
  return isWithinRefundWindow({
    refundWindowHours: hours,
    timeslotStart: opts.timeslotStart,
    now: opts.now,
  });
}

/** Preview copy helper for cancel UI. */
export function getCancelRefundPreview(opts: {
  policy: TenantRefundPolicy;
  paymentMethod: CancelPaymentMethod;
  timeslotStart: Date | string;
  now?: Date;
}): {
  willRefund: boolean;
  kind: CancelRefundKind;
  windowHours: number | null;
} {
  if (opts.paymentMethod !== "stripe" && opts.paymentMethod !== "class_pass") {
    return { willRefund: false, kind: "none", windowHours: null };
  }
  const windowHours = resolveRefundWindowHours({
    defaultWindowHours: opts.policy?.defaultWindowHours,
    override: getMethodOverride(opts.policy, opts.paymentMethod),
  });
  const willRefund = isWithinRefundWindow({
    refundWindowHours: windowHours,
    timeslotStart: opts.timeslotStart,
    now: opts.now,
  });
  return {
    willRefund,
    kind: willRefund ? opts.paymentMethod : "none",
    windowHours,
  };
}

export function formatCancelRefundMessage(preview: {
  willRefund: boolean;
  kind: CancelRefundKind;
}): string {
  if (preview.kind === "stripe" && preview.willRefund) {
    return "Your drop-in payment will be refunded.";
  }
  if (preview.kind === "class_pass" && preview.willRefund) {
    return "Your class-pass credit will be restored.";
  }
  return "This booking will be cancelled without a refund or class-pass credit restore.";
}
