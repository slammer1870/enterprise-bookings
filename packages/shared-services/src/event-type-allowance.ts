/**
 * Pools on event-type override rows for class passes and memberships.
 * The types listed on a row share that row's sessions or credits.
 * Types on no row share the plan sessions or the pass quantity.
 */

export type RelationValue =
  | number
  | string
  | { id?: number | string | null }
  | null
  | undefined;

export const SESSION_INTERVALS = ["day", "week", "month", "quarter", "year"] as const;
export type SessionInterval = (typeof SESSION_INTERVALS)[number];

const SESSION_INTERVAL_LABELS: Record<SessionInterval, string> = {
  day: "Days",
  week: "Weeks",
  month: "Months",
  quarter: "Quarters",
  year: "Years",
};

export function sessionIntervalSelectOptions(): Array<{ label: string; value: SessionInterval }> {
  return SESSION_INTERVALS.map((value) => ({
    label: SESSION_INTERVAL_LABELS[value],
    value,
  }));
}

export type EventTypeOverrideRow = {
  id?: string | null;
  /** Legacy single type. Used when `eventTypes` is empty. */
  eventType?: unknown;
  /** Types that share this row's sessions or credits. */
  eventTypes?: unknown;
  quantity?: number | null;
  sessions?: number | null;
  /**
   * When both are set, this event type is counted in this window.
   * Blank keeps the plan's sessions interval.
   */
  interval?: string | null;
  intervalCount?: number | null;
  /** When set, replaces the product cap for every type on this row. Blank inherits the product cap. */
  maxBookingsPerTimeslot?: number | null;
};

export type SessionWindow = {
  interval: SessionInterval;
  intervalCount: number;
};

export function isSessionInterval(value: unknown): value is SessionInterval {
  return typeof value === "string" && (SESSION_INTERVALS as readonly string[]).includes(value);
}

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

/** Types on a pool row. A legacy row with only `eventType` is a pool of one. */
export function overrideEventTypeIds(
  row: EventTypeOverrideRow | null | undefined,
): number[] {
  const many = relationIds(row?.eventTypes);
  if (many.length > 0) return many;
  const single = relationId(row?.eventType);
  return single == null ? [] : [single];
}

export function overrideCount(
  rows: EventTypeOverrideRow[] | null | undefined,
  eventTypeId: number,
  field: "quantity" | "sessions" | "maxBookingsPerTimeslot",
): number | null {
  if (!Array.isArray(rows)) return null;
  for (const row of rows) {
    if (!overrideEventTypeIds(row).includes(eventTypeId)) continue;
    const count = coerceCount(row?.[field]);
    if (count == null) return null;
    return count;
  }
  return null;
}

/**
 * Per-timeslot cap from an override row for this event type.
 * `undefined` means no row set a number, so the product cap still applies.
 */
export function maxBookingsPerTimeslotOverride(
  rows: EventTypeOverrideRow[] | null | undefined,
  eventTypeId: number | null,
): number | undefined {
  if (eventTypeId == null) return undefined;
  const max = overrideCount(rows, eventTypeId, "maxBookingsPerTimeslot");
  if (max == null || max < 1) return undefined;
  return Math.max(1, max);
}

/**
 * Row cap when this event type has one; otherwise `productCap`.
 * A numeric cap stays a number. `null` or `undefined` stays unbounded.
 */
export function maxBookingsPerTimeslotForEventType<
  T extends number | null | undefined,
>(
  rows: EventTypeOverrideRow[] | null | undefined,
  eventTypeId: number | null,
  productCap: T,
): number | T {
  return maxBookingsPerTimeslotOverride(rows, eventTypeId) ?? productCap;
}

/**
 * Keep `value` when this event type has no row cap.
 * A row cap replaces `maxBookingsPerTimeslot` on a copy, for this event type only.
 */
export function withMaxBookingsPerTimeslotOverride<
  T extends { maxBookingsPerTimeslot?: number | null },
>(
  value: T,
  rows: EventTypeOverrideRow[] | null | undefined,
  eventTypeId: number | null,
): T {
  const eventTypeMax = maxBookingsPerTimeslotOverride(rows, eventTypeId);
  if (eventTypeMax == null) return value;
  return { ...value, maxBookingsPerTimeslot: eventTypeMax };
}

export type AllowanceKind =
  | { kind: "disallowed" }
  | { kind: "unlimited" }
  | {
      kind: "limited";
      limit: number;
      eventTypeIds: number[] | null;
      interval: SessionInterval;
      intervalCount: number;
    };

type SessionsInfo = {
  sessions?: number | null;
  interval?: string | null;
  intervalCount?: number | null;
  eventTypeOverrides?: EventTypeOverrideRow[] | null;
} | null | undefined;

function sessionWindowFrom(
  interval: unknown,
  intervalCount: unknown,
): SessionWindow | null {
  const count = coerceCount(intervalCount);
  if (!isSessionInterval(interval) || count == null || count <= 0) return null;
  return { interval, intervalCount: count };
}

/**
 * A row interval is that event type's window.
 * Blank Per means 1, the same default as a plan interval with no count.
 * No row interval keeps the plan window.
 */
function windowForOverrideRow(
  row: EventTypeOverrideRow | undefined,
  planWindow: SessionWindow | null,
): SessionWindow | null {
  if (!isSessionInterval(row?.interval)) return planWindow;
  const count = coerceCount(row.intervalCount);
  return {
    interval: row.interval,
    intervalCount: count != null && count > 0 ? count : 1,
  };
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
  const planWindow = sessionWindowFrom(sessions?.interval, sessions?.intervalCount);

  if (eventTypeId != null && hasAllowList && !allowedIds!.includes(eventTypeId)) {
    return { kind: "disallowed" };
  }

  if (eventTypeId != null) {
    const override = overrideCount(rows, eventTypeId, "sessions");
    if (override != null) {
      const row = rows.find((entry) => overrideEventTypeIds(entry).includes(eventTypeId));
      const window = windowForOverrideRow(row, planWindow);
      if (window == null) return { kind: "unlimited" };
      return {
        kind: "limited",
        limit: Math.max(1, override),
        eventTypeIds: overrideEventTypeIds(row),
        interval: window.interval,
        intervalCount: window.intervalCount,
      };
    }
  }

  const sharedLimit = coerceCount(sessions?.sessions);
  if (sharedLimit == null || sharedLimit <= 0 || planWindow == null) {
    return { kind: "unlimited" };
  }

  const sharedIds =
    allowedIds == null
      ? null
      : allowedIds.filter((id) => overrideCount(rows, id, "sessions") == null);

  if (eventTypeId != null && sharedIds != null && !sharedIds.includes(eventTypeId)) {
    return { kind: "disallowed" };
  }

  return {
    kind: "limited",
    limit: sharedLimit,
    eventTypeIds: sharedIds,
    interval: planWindow.interval,
    intervalCount: planWindow.intervalCount,
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
    eventTypes: number[];
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
    const eventTypes = overrideEventTypeIds(row);
    const quantity = coerceCount(row?.quantity);
    if (eventTypes.length === 0 || quantity == null) return [];
    return [{ eventTypes, quantity: Math.max(0, quantity) }];
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
  const sum = rows.reduce((total, row) => {
    if (overrideEventTypeIds(row).length === 0) return total;
    const quantity = coerceCount(row?.quantity);
    return quantity == null ? total : total + Math.max(0, quantity);
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
    eventTypes: number[];
    quantity: number;
  }>;
  status: "active" | "used" | "expired" | "cancelled";
};

function normalizedOverrideRows(
  rows: EventTypeOverrideRow[] | null | undefined,
): AdjustedClassPass["eventTypeOverrides"] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    const eventTypes = overrideEventTypeIds(row);
    const quantity = coerceCount(row?.quantity);
    if (eventTypes.length === 0 || quantity == null) return [];
    return [{ id: row.id ?? undefined, eventTypes, quantity: Math.max(0, quantity) }];
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
  // A missing event type used to land on the shared pool. That spends or refunds
  // the wrong bucket when this pass has override rows.
  if (eventTypeId == null && rows.length > 0) {
    return {
      ok: false,
      error: "Could not resolve the event type for this class pass.",
    };
  }
  const overrideIndex =
    eventTypeId == null
      ? -1
      : rows.findIndex((row) => row.eventTypes.includes(eventTypeId));

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

export type AllowedEventTypesForSave = {
  /** Effective allow-list, including stored types when the save omits the field. */
  ids: number[];
  /** Set when an override type was missing, so the caller writes the field. Null leaves it untouched. */
  idsToStore: number[] | null;
};

/**
 * An override row is an extra allowance, so its event type has to stay allowed.
 * `ids` is the allow-list for validation and allowance rules.
 * `idsToStore` is that list only when a type was appended.
 * When Allowed is omitted from the save, `storedAllowedEventTypes` supplies the types already on the document.
 */
export function allowedEventTypeIdsIncludingOverrides(
  allowedEventTypes: unknown,
  rows: Array<EventTypeOverrideRow | null | undefined> | null | undefined,
  storedAllowedEventTypes?: unknown,
): AllowedEventTypesForSave {
  const list = Array.isArray(rows) ? rows : [];
  const ids =
    allowedEventTypes === undefined
      ? relationIds(storedAllowedEventTypes)
      : relationIds(allowedEventTypes);
  let added = false;
  for (const row of list) {
    for (const eventTypeId of overrideEventTypeIds(row)) {
      if (!ids.includes(eventTypeId)) {
        ids.push(eventTypeId);
        added = true;
      }
    }
  }
  return { ids, idsToStore: added ? ids : null };
}

export function validateEventTypeOverrideRows(input: {
  allowedEventTypeIds: number[];
  rows: Array<{
    eventTypeId?: number | null;
    eventTypeIds?: number[] | null;
    count: number | null;
  }>;
}): string | true {
  const seen = new Set<number>();
  for (const row of input.rows) {
    const ids =
      Array.isArray(row.eventTypeIds) && row.eventTypeIds.length > 0
        ? row.eventTypeIds
        : row.eventTypeId != null
          ? [row.eventTypeId]
          : [];
    if (ids.length === 0) return "Each override needs an event type.";
    for (const eventTypeId of ids) {
      if (!input.allowedEventTypeIds.includes(eventTypeId)) {
        return "Override event types must be included in the allowed event types.";
      }
      if (seen.has(eventTypeId)) {
        return "Each event type can only be overridden once.";
      }
      seen.add(eventTypeId);
    }
    if (row.count == null || row.count < 1) {
      return "Override counts must be at least 1.";
    }
  }
  return true;
}
