import type {
  CollectionSlug,
  Payload,
  PayloadRequest,
  SelectType,
  TaskHandler,
  Where,
} from "payload";
import { addDays } from "date-fns";
import { TZDate } from "@date-fns/tz";
import { resolveTimeZone } from "@repo/shared-utils";

import { TaskGenerateTimeslotsFromSchedule } from "../types";
import {
  GenerationProgressReporter,
  resolveGenerationJobId,
} from "./generation-progress";

import type { BookingCollectionSlugs } from "../resolve-slugs";

/** Normalize relationship value to ID (handles populated { id } or raw number). */
function toId(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  if (typeof value === "object" && value !== null && "id" in value) {
    const id = (value as { id: number }).id;
    return typeof id === "number" ? id : null;
  }
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function hasTenantsCollection(
  payload: { collections?: Record<string, unknown> }
): boolean {
  return Boolean(payload.collections && "tenants" in payload.collections);
}

function hasTimeZone(value: unknown): value is { timeZone?: string | null } {
  return typeof value === "object" && value !== null && "timeZone" in value;
}

function hasLocationsCollection(
  payload: { collections?: Record<string, unknown> },
): boolean {
  return Boolean(payload.collections && "locations" in payload.collections);
}

const LOCATIONS_COLLECTION_SLUG = "locations" as CollectionSlug;

const EXISTING_TIMESLOTS_PAGE_SIZE = 500;
const CREATE_BATCH_SIZE = 25;
const CLEAR_TIMESLOT_BATCH_SIZE = 100;
const CLEAR_BOOKING_BATCH_SIZE = 500;

function existingTimeslotKey(
  startTime: string,
  endTime: string,
  location: unknown,
): string {
  const locationKey =
    location == null || location === "" ? "" : String(location);
  return `${startTime}|${endTime}|${locationKey}`;
}

/** Active booking statuses that should prevent a timeslot from being cleared. */
const BOOKING_STATUSES_BLOCKING_CLEAR = ["pending", "confirmed", "waiting"] as const;

function buildTimeslotRangeWhereConditions(args: {
  rangeStart: TZDate;
  rangeEnd: TZDate;
  tenantId: number | null;
  branchId: number | null;
  includeLegacyNullBranch: boolean;
}): Where[] {
  const { rangeStart, rangeEnd, tenantId, branchId, includeLegacyNullBranch } =
    args;

  const whereConditions: Where[] = [
    { startTime: { less_than_equal: rangeEnd.toISOString() } },
    { endTime: { greater_than_equal: rangeStart.toISOString() } },
  ];

  if (tenantId != null) {
    whereConditions.push({ tenant: { equals: tenantId } });
  }

  if (branchId != null) {
    if (includeLegacyNullBranch) {
      whereConditions.push({
        or: [
          { branch: { equals: branchId } },
          { branch: { exists: false } },
        ],
      });
    } else {
      whereConditions.push({ branch: { equals: branchId } });
    }
  }

  return whereConditions;
}

async function paginateTimeslotsInRange<T extends Record<string, unknown>>(args: {
  payload: Payload;
  req: PayloadRequest;
  timeslotsSlug: CollectionSlug;
  whereConditions: Where[];
  select?: SelectType;
}): Promise<T[]> {
  const { payload, req, timeslotsSlug, whereConditions, select } = args;
  const docs: T[] = [];
  let page = 1;

  while (true) {
    const result = await payload.find({
      collection: timeslotsSlug,
      where: { and: whereConditions },
      depth: 0,
      limit: EXISTING_TIMESLOTS_PAGE_SIZE,
      page,
      ...(select ? { select } : {}),
      overrideAccess: true,
      req,
    });

    docs.push(...(result.docs as unknown as T[]));

    if (!result.hasNextPage) break;
    page += 1;
  }

  return docs;
}

async function fetchExistingTimeslotKeys(args: {
  payload: Payload;
  req: PayloadRequest;
  timeslotsSlug: CollectionSlug;
  rangeStart: TZDate;
  rangeEnd: TZDate;
  tenantId: number | null;
  branchId: number | null;
  includeLegacyNullBranch: boolean;
}): Promise<Set<string>> {
  const {
    payload,
    req,
    timeslotsSlug,
    rangeStart,
    rangeEnd,
    tenantId,
    branchId,
    includeLegacyNullBranch,
  } = args;

  const whereConditions = buildTimeslotRangeWhereConditions({
    rangeStart,
    rangeEnd,
    tenantId,
    branchId,
    includeLegacyNullBranch,
  });

  const docs = await paginateTimeslotsInRange<{
    startTime?: string;
    endTime?: string;
    location?: unknown;
  }>({
    payload,
    req,
    timeslotsSlug,
    whereConditions,
    select: {
      startTime: true,
      endTime: true,
      location: true,
    },
  });

  const keys = new Set<string>();
  for (const doc of docs) {
    if (doc.startTime && doc.endTime) {
      keys.add(existingTimeslotKey(doc.startTime, doc.endTime, doc.location));
    }
  }

  return keys;
}

async function createTimeslotsInBatches(args: {
  payload: Payload;
  req: PayloadRequest;
  timeslotsSlug: CollectionSlug;
  records: Record<string, unknown>[];
  onBatchComplete?: (_created: number, _total: number) => Promise<void>;
}): Promise<void> {
  const { payload, req, timeslotsSlug, records, onBatchComplete } = args;
  const baseContext = {
    ...(req.context || {}),
    skipTimeslotTimeNormalization: true,
    skipStaffMemberResolution: true,
    triggerAfterChange: false,
  };

  let created = 0;
  for (let i = 0; i < records.length; i += CREATE_BATCH_SIZE) {
    const batch = records.slice(i, i + CREATE_BATCH_SIZE);
    await Promise.all(
      batch.map((data) =>
        payload.create({
          collection: timeslotsSlug,
          data: data as any,
          context: baseContext,
          draft: false,
          req,
          overrideAccess: true,
        }),
      ),
    );
    created += batch.length;
    if (onBatchComplete) {
      await onBatchComplete(created, records.length);
    }
  }
}

async function resolveTimeslotBranchId(args: {
  payload: Payload;
  req: PayloadRequest;
  numericTenantId: number | null;
  inputBranch: unknown;
}): Promise<{
  branchId: number | null;
  errorMessage?: string;
  activeLocationCount: number;
}> {
  const { payload, req, numericTenantId, inputBranch } = args;

  if (!hasLocationsCollection(payload)) {
    return { branchId: null, activeLocationCount: 0 };
  }

  const explicit = toId(inputBranch);

  if (numericTenantId == null || Number.isNaN(numericTenantId)) {
    if (explicit == null) return { branchId: null, activeLocationCount: 0 };
    const doc = await payload
      .findByID({
        collection: LOCATIONS_COLLECTION_SLUG,
        id: explicit,
        depth: 0,
        overrideAccess: true,
        req,
      })
      .catch(() => null);
    if (!doc) {
      return {
        branchId: null,
        activeLocationCount: 0,
        errorMessage: `Branch location id ${explicit} was not found.`,
      };
    }
    return { branchId: explicit, activeLocationCount: 1 };
  }

  const locs = await payload.find({
    collection: LOCATIONS_COLLECTION_SLUG,
    where: {
      and: [{ tenant: { equals: numericTenantId } }, { active: { equals: true } }],
    },
    limit: 200,
    depth: 0,
    overrideAccess: true,
    req,
  });

  const activeIds = (locs.docs as { id?: unknown }[])
    .map((d) => toId(d.id))
    .filter((id): id is number => id != null);
  const activeLocationCount = activeIds.length;

  if (explicit != null) {
    if (!activeIds.includes(explicit)) {
      return {
        branchId: null,
        activeLocationCount,
        errorMessage: `Branch ${explicit} is not an active location for this tenant (or does not exist).`,
      };
    }
    return { branchId: explicit, activeLocationCount };
  }

  if (activeIds.length === 0) {
    return { branchId: null, activeLocationCount: 0 };
  }
  if (activeIds.length === 1) {
    return { branchId: activeIds[0]!, activeLocationCount: 1 };
  }
  return {
    branchId: null,
    activeLocationCount,
    errorMessage:
      "This tenant has more than one active site/branch. Set the task input field `branch` to a location id (or add a default branch on the scheduler) before generating timeslots.",
  };
}

export function createGenerateTimeslotsFromScheduleHandler(
  slugs: BookingCollectionSlugs,
): TaskHandler<"generateTimeslotsFromSchedule"> {
  const timeslotsSlug = slugs.timeslots as CollectionSlug;
  const bookingsSlug = slugs.bookings as CollectionSlug;

  return async ({ input, req }) => {
  const {
    startDate,
    endDate,
    week,
    clearExisting,
    defaultEventType,
    lockOutTime,
    branch,
  } = input as TaskGenerateTimeslotsFromSchedule["input"];

  const { payload } = req;

  const defaultEventTypeId = toId(defaultEventType);

  if (!startDate || !endDate || !week) {
    return {
      output: {
        success: false,
        message: "Missing required parameters",
      },
    };
  }

  const fallbackTimeZone = resolveTimeZone(
    payload.config.admin.timezones.defaultTimezone
  );
  let timeZone = fallbackTimeZone;

  const tenantRef = req.context?.tenant as
    | number
    | string
    | { id?: number | string; timeZone?: string | null }
    | undefined;

  if (tenantRef && typeof tenantRef === "object" && typeof tenantRef.timeZone === "string") {
    timeZone = resolveTimeZone(tenantRef.timeZone, fallbackTimeZone);
  } else {
    const tenantId =
      tenantRef && typeof tenantRef === "object"
        ? tenantRef.id
        : tenantRef;

    if (tenantId != null && hasTenantsCollection(payload)) {
      try {
        const tenant = await payload.findByID({
          collection: "tenants" as CollectionSlug,
          id: tenantId,
          depth: 0,
          overrideAccess: true,
          req,
        });
        timeZone = resolveTimeZone(
          hasTimeZone(tenant) && typeof tenant.timeZone === "string"
            ? tenant.timeZone
            : null,
          fallbackTimeZone
        );
      } catch {
        timeZone = fallbackTimeZone;
      }
    }
  }

  // Interpret the schedule boundaries in the scheduler's timezone.
  // This prevents server-local timezone (often UTC in prod) from shifting the
  // calendar day around DST boundaries (e.g. Europe/Dublin late March).
  const startInstant = new Date(startDate);
  const startInTZ = new TZDate(startInstant, timeZone);
  const start = new TZDate(
    startInTZ.getFullYear(),
    startInTZ.getMonth(),
    startInTZ.getDate(),
    0,
    0,
    0,
    0,
    timeZone
  );

  const endInstant = new Date(endDate);
  const endInTZ = new TZDate(endInstant, timeZone);
  const end = new TZDate(
    endInTZ.getFullYear(),
    endInTZ.getMonth(),
    endInTZ.getDate(),
    23,
    59,
    59,
    999,
    timeZone
  );

  const rawTenantForBranch = req.context?.tenant as unknown;
  const tenantIdForBranch =
    rawTenantForBranch && typeof rawTenantForBranch === "object" && "id" in rawTenantForBranch
      ? (rawTenantForBranch as { id: string | number }).id
      : (rawTenantForBranch as string | number | undefined);
  const numericTenantIdForBranch =
    tenantIdForBranch == null
      ? null
      : typeof tenantIdForBranch === "number"
        ? tenantIdForBranch
        : Number(tenantIdForBranch);
  const hasTenantForBranch =
    numericTenantIdForBranch != null && !Number.isNaN(numericTenantIdForBranch);

  const branchResolution = await resolveTimeslotBranchId({
    payload,
    req,
    numericTenantId: hasTenantForBranch ? numericTenantIdForBranch : null,
    inputBranch: branch,
  });
  if (branchResolution.errorMessage) {
    return {
      output: {
        success: false,
        message: branchResolution.errorMessage,
      },
    };
  }
  const resolvedBranchId = branchResolution.branchId;
  const includeLegacyNullBranch =
    resolvedBranchId != null && branchResolution.activeLocationCount <= 1;

  const numericTenantId =
    hasTenantForBranch && numericTenantIdForBranch != null ? numericTenantIdForBranch : null;
  const hasTenantContext = hasTenantForBranch;
  const schedulerId = toId((input as { schedulerId?: unknown }).schedulerId);
  const progressReporter = new GenerationProgressReporter(
    payload,
    req,
    resolveGenerationJobId(req),
    schedulerId,
  );
  let skippedCount = 0;
  const daysTotal = Math.max(
    1,
    Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1,
  );
  let daysProcessed = 0;
  let successMessage = "Timeslots generated successfully";

  await progressReporter.report(
    {
      phase: clearExisting ? "clearing" : "planning",
      daysProcessed: 0,
      daysTotal,
    },
    { force: true },
  );

  try {
    if (clearExisting) {
      payload.logger.info("Clearing existing timeslots");
      await progressReporter.report({ phase: "clearing" }, { force: true });
      try {
        const whereConditions = buildTimeslotRangeWhereConditions({
          rangeStart: start,
          rangeEnd: end,
          tenantId: numericTenantId,
          branchId: resolvedBranchId,
          includeLegacyNullBranch,
        });

        const timeslotDocs = await paginateTimeslotsInRange<{ id?: unknown }>({
          payload,
          req,
          timeslotsSlug,
          whereConditions,
          select: { id: true },
        });

        const timeslotIds = timeslotDocs
          .map((doc) => toId(doc.id))
          .filter((id): id is number => id != null);

        const timeslotsToNotDelete = new Set<number>();
        for (let i = 0; i < timeslotIds.length; i += CLEAR_BOOKING_BATCH_SIZE) {
          const batchIds = timeslotIds.slice(i, i + CLEAR_BOOKING_BATCH_SIZE);
          if (batchIds.length === 0) continue;

          const protectedBookings = await payload.find({
            collection: bookingsSlug,
            where: {
              and: [
                { timeslot: { in: batchIds } },
                { status: { in: [...BOOKING_STATUSES_BLOCKING_CLEAR] } },
              ],
            },
            depth: 0,
            limit: 0,
            select: { timeslot: true },
            overrideAccess: true,
            req,
          });

          for (const booking of protectedBookings.docs as Array<{ timeslot?: unknown }>) {
            const timeslotId = toId(booking.timeslot);
            if (timeslotId != null) {
              timeslotsToNotDelete.add(timeslotId);
            }
          }
        }

        const idsToDelete = timeslotIds.filter((id) => !timeslotsToNotDelete.has(id));
        const totalToClear = idsToDelete.length;

        await progressReporter.report(
          { phase: "clearing", cleared: 0, total: totalToClear },
          { force: true },
        );

        for (let i = 0; i < idsToDelete.length; i += CLEAR_BOOKING_BATCH_SIZE) {
          const batchIds = idsToDelete.slice(i, i + CLEAR_BOOKING_BATCH_SIZE);
          if (batchIds.length === 0) continue;

          await payload.delete({
            collection: bookingsSlug,
            where: {
              timeslot: { in: batchIds },
            },
            context: {
              triggerAfterChange: false,
            },
            overrideAccess: true,
            req,
          });
        }

        let cleared = 0;
        for (let i = 0; i < idsToDelete.length; i += CLEAR_TIMESLOT_BATCH_SIZE) {
          const batchIds = idsToDelete.slice(i, i + CLEAR_TIMESLOT_BATCH_SIZE);
          if (batchIds.length === 0) continue;

          await payload.delete({
            collection: timeslotsSlug,
            where: {
              id: { in: batchIds },
            },
            context: {
              triggerAfterChange: false,
              skipTimeslotBookingCascade: true,
            },
            overrideAccess: true,
            req,
          });

          cleared += batchIds.length;
          await progressReporter.report(
            {
              phase: "clearing",
              cleared,
              total: totalToClear,
            },
            { force: cleared >= totalToClear },
          );
        }
      } catch (error) {
        console.error("Error clearing existing timeslots:", error);
      }
    }

    await progressReporter.report(
      { phase: "planning", daysProcessed: 0, daysTotal },
      { force: true },
    );

    const existingTimeslotKeys = await fetchExistingTimeslotKeys({
      payload,
      req,
      timeslotsSlug,
      rangeStart: start,
      rangeEnd: end,
      tenantId: hasTenantContext ? numericTenantId : null,
      branchId: resolvedBranchId,
      includeLegacyNullBranch,
    });

    const pendingCreates: Record<string, unknown>[] = [];

    // IMPORTANT: Keep `currentDate` as a timezone-aware date.
    // Converting to a plain `Date` and then reading Y/M/D via getters will use the
    // server timezone (often UTC) and can shift the calendar day after DST starts.
    let currentDate = start;
    while (currentDate <= end) {
      const currentInTZ = new TZDate(currentDate, timeZone);

      // Derive weekday in the scheduler's timezone (NOT server timezone),
      // otherwise we can map "Monday" slots onto "Sunday" when DST shifts.
      const dayOfWeek = currentInTZ.getDay();

      // Find the corresponding day in the schedule
      // JavaScript getDay(): 0=Sunday, 1=Monday, 2=Tuesday, ..., 6=Saturday
      // week.days array: 0=Monday, 1=Tuesday, ..., 5=Saturday, 6=Sunday
      // Convert JavaScript day (0-6, Sunday first) to schedule array index (0-6, Monday first)
      const scheduleIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const scheduleDay = week.days[scheduleIndex];

      if (!scheduleDay || !scheduleDay.timeSlot) {
        daysProcessed += 1;
        await progressReporter.report({
          phase: "planning",
          daysProcessed,
          daysTotal,
        });
        const next = addDays(currentInTZ, 1);
        currentDate = new TZDate(
          next.getFullYear(),
          next.getMonth(),
          next.getDate(),
          0,
          0,
          0,
          0,
          timeZone
        );
        continue;
      }

      const timeSlots = scheduleDay.timeSlot;

      for (const timeSlot of timeSlots) {
        // Extract time components from the stored time slots
        // The scheduler stores times as timestamps, but we only care about the wall-clock time
        // We MUST interpret these instants in the tenant timezone.
        //
        // Why: Payload time-only fields are stored as real Date instants. The underlying UTC time
        // can differ depending on whether the slot was created/edited during DST. If we read UTC
        // hours (getUTCHours), a slot that was entered as 18:45 in Europe/Dublin during DST may
        // appear as 17:45 and generate timeslots one hour early after DST boundaries.
        //
        // By converting the stored instant into the tenant timezone and then extracting local
        // hours/minutes, we preserve the wall-clock time the admin selected.
        const startInTZ = new TZDate(new Date(timeSlot.startTime), timeZone);
        const endInTZ = new TZDate(new Date(timeSlot.endTime), timeZone);

        const startHours = startInTZ.getHours();
        const startMinutes = startInTZ.getMinutes();
        const endHours = endInTZ.getHours();
        const endMinutes = endInTZ.getMinutes();

        // Use TZDate to create dates in the specified timezone
        // This ensures that times remain consistent across DST boundaries
        const timeslotStartTime = new TZDate(
          currentInTZ.getFullYear(),
          currentInTZ.getMonth(),
          currentInTZ.getDate(),
          startHours,
          startMinutes,
          0,
          0,
          timeZone
        );

        const timeslotEndTime = new TZDate(
          currentInTZ.getFullYear(),
          currentInTZ.getMonth(),
          currentInTZ.getDate(),
          endHours,
          endMinutes,
          0,
          0,
          timeZone
        )

        const startIso = timeslotStartTime.toISOString();
        const endIso = timeslotEndTime.toISOString();
        const duplicateKey = existingTimeslotKey(
          startIso,
          endIso,
          timeSlot.location,
        );

        if (existingTimeslotKeys.has(duplicateKey)) {
          skippedCount += 1;
          continue;
        }

        // Create a timezone-aware date for the timeslot date field
        const timeslotDate = new TZDate(
          currentInTZ.getFullYear(),
          currentInTZ.getMonth(),
          currentInTZ.getDate(),
          0,
          0,
          0,
          0,
          timeZone
        );

        const eventTypeId =
          toId(timeSlot.eventType) ?? defaultEventTypeId;
        if (eventTypeId == null) {
          payload.logger.warn(
            `Skipping timeslot: no valid eventType for slot ${timeSlot.startTime}`
          );
          continue;
        }

        // Coerce to number so Payload relationship validation always receives a number ID
        const eventTypeIdNum =
          typeof eventTypeId === "number" && !Number.isNaN(eventTypeId)
            ? eventTypeId
            : Number(eventTypeId);
        if (Number.isNaN(eventTypeIdNum)) {
          payload.logger.warn(
            `Skipping timeslot: eventType id is not a valid number for slot ${timeSlot.startTime}`
          );
          continue;
        }

        const lockOut = Number(timeSlot.lockOutTime) || Number(lockOutTime);
        const timeslotData: Record<string, unknown> = {
          date: timeslotDate.toISOString(),
          startTime: startIso,
          endTime: endIso,
          eventType: eventTypeIdNum,
          location: timeSlot.location || null,
          staffMember: toId(timeSlot.staffMember) ?? undefined,
          lockOutTime: lockOut,
          originalLockOutTime: lockOut,
          active: timeSlot.active !== false,
        };

        if (hasTenantContext) {
          timeslotData.tenant = numericTenantId;
        }

        if (resolvedBranchId != null) {
          timeslotData.branch = resolvedBranchId;
        }

        pendingCreates.push(timeslotData);
        existingTimeslotKeys.add(duplicateKey);
      }

      daysProcessed += 1;
      await progressReporter.report({
        phase: "planning",
        daysProcessed,
        daysTotal,
        skipped: skippedCount,
      });

      // Advance by calendar days in the scheduler timezone, then normalize back to
      // midnight to keep the loop stable across DST transitions.
      const next = addDays(currentInTZ, 1);
      currentDate = new TZDate(
        next.getFullYear(),
        next.getMonth(),
        next.getDate(),
        0,
        0,
        0,
        0,
        timeZone
      );
    }

    const createdCount = pendingCreates.length;

    if (createdCount > 0) {
      payload.logger.info(
        `Creating ${createdCount} timeslots in batches of ${CREATE_BATCH_SIZE}`,
      );
      await progressReporter.report(
        {
          phase: "creating",
          created: 0,
          total: createdCount,
          skipped: skippedCount,
        },
        { force: true },
      );
      await createTimeslotsInBatches({
        payload,
        req,
        timeslotsSlug,
        records: pendingCreates,
        onBatchComplete: async (created, total) => {
          await progressReporter.report({
            phase: "creating",
            created,
            total,
            skipped: skippedCount,
          });
        },
      });
    }

    const messageParts: string[] = [];
    if (createdCount > 0) {
      messageParts.push(
        `Created ${createdCount.toLocaleString()} timeslot${createdCount === 1 ? "" : "s"}`,
      );
    }
    if (skippedCount > 0) {
      messageParts.push(
        `${skippedCount.toLocaleString()} already existed`,
      );
    }
    successMessage =
      messageParts.length > 0
        ? messageParts.join(" · ")
        : "Timeslots generated successfully";

    await progressReporter.report(
      {
        phase: "done",
        created: createdCount,
        total: createdCount,
        skipped: skippedCount,
      },
      { force: true },
    );
  } catch (error) {
    console.error("Error generating timeslots:", error);
    return {
      output: {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      },
    };
  }

  return {
    output: {
      success: true,
      message: successMessage,
    },
  };
  };
}
