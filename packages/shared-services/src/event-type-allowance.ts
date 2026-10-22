/**
 * Per-event-type allowances for class passes and memberships.
 * A row replaces the shared pool for that event type only.
 */

export type RelationValue =
  | number
  | string
  | { id?: number | string | null }
  | null
  | undefined;

export type EventTypeOverrideRow = {
  id?: string | null;
  eventType?: unknown;
  quantity?: number | null;
  sessions?: number | null;
};

export function relationId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  if (typeof value === "object" && value != null && "id" in value) {
    return relationId((value as { id?: unknown }).id);
  }
  return null;
}

export function relationIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const ids: number[] = [];
  for (const entry of value) {
    const id = relationId(entry);
    if (id != null && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

function coerceCount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function overrideCount(
  rows: EventTypeOverrideRow[] | null | undefined,
  eventTypeId: number,
  field: "quantity" | "sessions",
): number | null {
  if (!Array.isArray(rows)) return null;
  for (const row of rows) {
    if (relationId(row?.eventType) !== eventTypeId) continue;
    const count = coerceCount(row?.[field]);
    if (count == null) return null;
    return count;
  }
  return null;
}

export type AllowanceKind =
  | { kind: "disallowed" }
  | { kind: "unlimited" }
  | { kind: "limited"; limit: number; eventTypeIds: number[] | null };

type SessionsInfo = {
  sessions?: number | null;
  interval?: string | null;
  intervalCount?: number | null;
  eventTypeOverrides?: EventTypeOverrideRow[] | null;
} | null | undefined;

function windowReady(sessions: SessionsInfo): boolean {
  const count = coerceCount(sessions?.intervalCount);
  return Boolean(sessions?.interval) && count != null && count > 0;
}

/**
 * Bucket for a membership lesson.
 * `eventTypeId` null keeps the legacy shared count (no event-type filter)
 * when the plan has no allow-list yet.
 */
export function membershipBucketForEventType(
  plan: {
    allowedEventTypes?: unknown;
    sessionsInformation?: SessionsInfo;
  } | null | undefined,
  eventTypeId: number | null,
): AllowanceKind {
  const sessions = plan?.sessionsInformation;
  const rows = Array.isArray(sessions?.eventTypeOverrides)
    ? sessions.eventTypeOverrides
    : [];
  const hasAllowList = Array.isArray(plan?.allowedEventTypes);
  const allowedIds = hasAllowList ? relationIds(plan?.allowedEventTypes) : null;

  if (eventTypeId != null && hasAllowList && !allowedIds!.includes(eventTypeId)) {
    return { kind: "disallowed" };
  }

  if (eventTypeId != null) {
    const override = overrideCount(rows, eventTypeId, "sessions");
    if (override != null) {
      if (!windowReady(sessions)) return { kind: "unlimited" };
      return {
        kind: "limited",
        limit: Math.max(1, override),
        eventTypeIds: [eventTypeId],
      };
    }
  }

  const sharedLimit = coerceCount(sessions?.sessions);
  const sharedReady =
    sharedLimit != null && sharedLimit > 0 && windowReady(sessions);
  if (!sharedReady) return { kind: "unlimited" };

  const sharedIds =
    allowedIds == null
      ? null
      : allowedIds.filter((id) => overrideCount(rows, id, "sessions") == null);

  if (eventTypeId != null && sharedIds != null && !sharedIds.includes(eventTypeId)) {
    return { kind: "disallowed" };
  }

  return {
    kind: "limited",
    limit: sharedLimit!,
    eventTypeIds: sharedIds,
  };
}

/** `null` means no offer. `"unlimited"` means the target has no cap for this event type. */
export function additionalSessionsForUpgrade(
  current: AllowanceKind,
  currentRemaining: number | null,
  target: AllowanceKind,
  targetRemaining: number | null,
): number | "unlimited" | null {
  if (target.kind === "disallowed") return null;
  if (current.kind === "unlimited") return null;
  if (target.kind === "unlimited") return "unlimited";
  const currentLeft = current.kind === "disallowed" ? 0 : (currentRemaining ?? 0);
  const targetLeft = targetRemaining ?? 0;
  const additional = targetLeft - currentLeft;
  return additional > 0 ? additional : null;
}

export type ClassPassCreditSnapshot = {
  quantity: number;
  eventTypeOverrides: Array<{
    eventType: number;
    quantity: number;
  }>;
};

type PassTypeLike = {
  quantity?: unknown;
  allowedEventTypes?: unknown;
  eventTypeOverrides?: EventTypeOverrideRow[] | null;
};

/** True when every allowed event type has its own row, so shared quantity is not a pool. */
export function classPassSharedPoolIsDisplayOnly(type: PassTypeLike): boolean {
  const allowed = relationIds(type.allowedEventTypes);
  if (allowed.length === 0) return false;
  const rows = type.eventTypeOverrides ?? [];
  return allowed.every((id) => overrideCount(rows, id, "quantity") != null);
}

/**
 * Spendable shared quantity plus override rows.
 * When every allowed event type has an override, shared quantity is 0.
 */
export function snapshotClassPassCredits(type: PassTypeLike): ClassPassCreditSnapshot {
  const rows = Array.isArray(type.eventTypeOverrides) ? type.eventTypeOverrides : [];
  const eventTypeOverrides = rows.flatMap((row) => {
    const eventType = relationId(row?.eventType);
    const quantity = coerceCount(row?.quantity);
    if (eventType == null || quantity == null) return [];
    return [{ eventType, quantity: Math.max(0, quantity) }];
  });
  const stored = coerceCount(type.quantity) ?? 0;
  const quantity = classPassSharedPoolIsDisplayOnly(type) ? 0 : Math.max(0, stored);
  return { quantity, eventTypeOverrides };
}

/** Product quantity shown in admin: the sum of overrides when they cover every allowed event type. */
export function displayQuantityForClassPassType(
  type: PassTypeLike,
  currentQuantity: number,
): number {
  if (!classPassSharedPoolIsDisplayOnly(type)) return currentQuantity;
  const rows = type.eventTypeOverrides ?? [];
  const sum = relationIds(type.allowedEventTypes).reduce((total, id) => {
    return total + (overrideCount(rows, id, "quantity") ?? 0);
  }, 0);
  return Math.max(1, sum);
}

export function creditsRemainingForEventType(
  pass: {
    quantity?: unknown;
    eventTypeOverrides?: EventTypeOverrideRow[] | null;
  },
  eventTypeId: number | null,
): number {
  if (eventTypeId != null) {
    const override = overrideCount(pass.eventTypeOverrides, eventTypeId, "quantity");
    if (override != null) return Math.max(0, override);
  }
  return Math.max(0, coerceCount(pass.quantity) ?? 0);
}

export type AdjustedClassPass = {
  quantity: number;
  eventTypeOverrides: Array<{
    id?: string | null;
    eventType: number;
    quantity: number;
  }>;
  status: "active" | "used" | "expired" | "cancelled";
};

function normalizedOverrideRows(
  rows: EventTypeOverrideRow[] | null | undefined,
): AdjustedClassPass["eventTypeOverrides"] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    const eventType = relationId(row?.eventType);
    const quantity = coerceCount(row?.quantity);
    if (eventType == null || quantity == null) return [];
    return [{ id: row.id ?? undefined, eventType, quantity: Math.max(0, quantity) }];
  });
}

export function classPassIsExhausted(
  quantity: number,
  rows: Array<{ quantity: number }>,
): boolean {
  return quantity <= 0 && rows.every((row) => row.quantity <= 0);
}

/**
 * delta < 0 spends, delta > 0 restores.
 * An override row is the bucket when this event type has one.
 */
export function adjustClassPassCredits(
  pass: {
    quantity?: unknown;
    status?: string | null;
    eventTypeOverrides?: EventTypeOverrideRow[] | null;
  },
  eventTypeId: number | null,
  delta: number,
): { ok: true; pass: AdjustedClassPass } | { ok: false; error: string } {
  const rows = normalizedOverrideRows(pass.eventTypeOverrides);
  let quantity = Math.max(0, coerceCount(pass.quantity) ?? 0);
  const overrideIndex =
    eventTypeId == null
      ? -1
      : rows.findIndex((row) => row.eventType === eventTypeId);

  if (overrideIndex >= 0) {
    const next = rows[overrideIndex]!.quantity + delta;
    if (next < 0) {
      return { ok: false, error: "Not enough credits for this event type." };
    }
    rows[overrideIndex] = { ...rows[overrideIndex]!, quantity: next };
  } else {
    const next = quantity + delta;
    if (next < 0) {
      return { ok: false, error: "Not enough credits on this pass." };
    }
    quantity = next;
  }

  const exhausted = classPassIsExhausted(quantity, rows);
  const previous = pass.status;
  const status: AdjustedClassPass["status"] =
    exhausted
      ? "used"
      : previous === "expired" || previous === "cancelled"
        ? previous
        : "active";

  return { ok: true, pass: { quantity, eventTypeOverrides: rows, status } };
}

export function validateEventTypeOverrideRows(input: {
  allowedEventTypeIds: number[];
  rows: Array<{ eventTypeId: number | null; count: number | null }>;
}): string | true {
  const seen = new Set<number>();
  for (const row of input.rows) {
    if (row.eventTypeId == null) return "Each override needs an event type.";
    if (!input.allowedEventTypeIds.includes(row.eventTypeId)) {
      return "Override event types must be included in the allowed event types.";
    }
    if (seen.has(row.eventTypeId)) {
      return "Each event type can only be overridden once.";
    }
    seen.add(row.eventTypeId);
    if (row.count == null || row.count < 1) {
      return "Override counts must be at least 1.";
    }
  }
  return true;
}
