import type { CollectionSlug, Payload, PayloadRequest, TaskHandler, Where } from "payload";
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

function existingTimeslotKey(
  startTime: string,
  endTime: string,
  location: unknown,
): string {
  const locationKey =
    location == null || location === "" ? "" : String(location);
  return `${startTime}|${endTime}|${locationKey}`;
}

async function fetchExistingTimeslotKeys(args: {
  payload: Payload;
  req: PayloadRequest;
  timeslotsSlug: CollectionSlug;
  rangeStart: TZDate;
  rangeEnd: TZDate;
  tenantId: number | null;
  branchId: number | null;
}): Promise<Set<string>> {
  const { payload, req, timeslotsSlug, rangeStart, rangeEnd, tenantId, branchId } =
    args;

  const whereConditions: Where[] = [
    { startTime: { greater_than_equal: rangeStart.toISOString() } },
    { endTime: { less_than_equal: rangeEnd.toISOString() } },
  ];

  if (tenantId != null) {
    whereConditions.push({ tenant: { equals: tenantId } });
  }
  if (branchId != null) {
    whereConditions.push({ branch: { equals: branchId } });
  }

  const keys = new Set<string>();
  let page = 1;

  while (true) {
    const result = await payload.find({
      collection: timeslotsSlug,
      where: { and: whereConditions },
      depth: 0,
      limit: EXISTING_TIMESLOTS_PAGE_SIZE,
      page,
      select: {
        startTime: true,
        endTime: true,
        location: true,
      },
      overrideAccess: true,
      req,
    });

    for (const doc of result.docs as Array<{
      startTime?: string;
      endTime?: string;
      location?: unknown;
    }>) {
      if (doc.startTime && doc.endTime) {
        keys.add(existingTimeslotKey(doc.startTime, doc.endTime, doc.location));
      }
    }

    if (!result.hasNextPage) break;
    page += 1;
  }

  return keys;
}

async function createTimeslotsInBatches(args: {
  payload: Payload;
  req: PayloadRequest;
  timeslotsSlug: CollectionSlug;
  records: Record<string, unknown>[];
  onBatchComplete?: (created: number, total: number) => Promise<void>;
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
}): Promise<{ branchId: number | null; errorMessage?: string }> {
  const { payload, req, numericTenantId, inputBranch } = args;

  if (!hasLocationsCollection(payload)) {
    return { branchId: null };
  }

  const explicit = toId(inputBranch);

  if (numericTenantId == null || Number.isNaN(numericTenantId)) {
    if (explicit == null) return { branchId: null };
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
      return { branchId: null, errorMessage: `Branch location id ${explicit} was not found.` };
    }
    return { branchId: explicit };
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

  if (explicit != null) {
    if (!activeIds.includes(explicit)) {
      return {
        branchId: null,
        errorMessage: `Branch ${explicit} is not an active location for this tenant (or does not exist).`,
      };
    }
    return { branchId: explicit };
  }

  if (activeIds.length === 0) {
    return { branchId: null };
  }
  if (activeIds.length === 1) {
    return { branchId: activeIds[0]! };
  }
  return {
    branchId: null,
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

  const numericTenantId =
    hasTenantForBranch && numericTenantIdForBranch != null ? numericTenantIdForBranch : null;
  const hasTenantContext = hasTenantForBranch;
  const progressReporter = new GenerationProgressReporter(
    payload,
    req,
    resolveGenerationJobId(req),
  );
  let skippedCount = 0;
  const daysTotal = Math.max(
    1,
    Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1,
  );
  let daysProcessed = 0;
  let successMessage = "Timeslots generated successfully";

  try {
    if (clearExisting) {
      payload.logger.info("Clearing existing timeslots");
      await progressReporter.report({ phase: "clearing" }, { force: true });
      try {
      // Get tenant from context if available (for multi-tenant support)
      const tenantId = tenantIdForBranch;

      // Build where clause with tenant filter if available
      const whereConditions: any[] = [
        {
          startTime: {
            greater_than_equal: start.toISOString(),
          },
        },
        {
          endTime: {
            less_than_equal: end.toISOString(),
          },
        },
      ]

      // Add tenant filter if tenant context is available
      if (tenantId) {
        whereConditions.push({
          tenant: {
            equals: tenantId,
          },
        })
      }

      // Scope clear to the specific branch so that sibling locations within the
      // same tenant are not affected when their scheduler is saved independently.
      if (resolvedBranchId != null) {
        whereConditions.push({
          branch: {
            equals: resolvedBranchId,
          },
        })
      }

      const whereClause = {
        and: whereConditions,
      }

        const timeslotQuery = await payload.find({
          collection: timeslotsSlug,
          where: whereClause as any,
          depth: 0,
          limit: 0,
          overrideAccess: true,
          req,
        });

        const timeslotIds = (timeslotQuery.docs as Array<{ id?: unknown }>)
          .map((doc) => toId(doc.id))
          .filter((id): id is number => id != null);

        const timeslotsToNotDelete: number[] = [];
        const BOOKING_ID_BATCH = 500;
        for (let i = 0; i < timeslotIds.length; i += BOOKING_ID_BATCH) {
          const batchIds = timeslotIds.slice(i, i + BOOKING_ID_BATCH);
          if (batchIds.length === 0) continue;

          const confirmedBookings = await payload.find({
            collection: bookingsSlug,
            where: {
              and: [
                { timeslot: { in: batchIds } },
                { status: { equals: "confirmed" } },
              ],
            },
            depth: 0,
            limit: 0,
            select: { timeslot: true },
            overrideAccess: true,
            req,
          });

          for (const booking of confirmedBookings.docs as Array<{ timeslot?: unknown }>) {
            const timeslotId = toId(booking.timeslot);
            if (timeslotId != null) {
              timeslotsToNotDelete.push(timeslotId);
            }
          }
        }

        // Build delete where clause with tenant filter if available
        const deleteWhereClause: any = {
          and: [
            {
              startTime: {
                greater_than_equal: start.toISOString(),
              },
            },
            {
              endTime: {
                less_than_equal: end.toISOString(),
              },
            },
            {
              id: {
                not_in: timeslotsToNotDelete,
              },
            },
          ],
        }

        // Add tenant filter if tenant context is available
        if (tenantId) {
          deleteWhereClause.and.push({
            tenant: {
              equals: tenantId,
            },
          })
        }

        // Scope delete to the specific branch so that sibling locations within
        // the same tenant are not affected when their scheduler is saved independently.
        if (resolvedBranchId != null) {
          deleteWhereClause.and.push({
            branch: {
              equals: resolvedBranchId,
            },
          })
        }

        await payload.delete({
          collection: timeslotsSlug,
          where: deleteWhereClause,
          context: {
            triggerAfterChange: false,
          },
          overrideAccess: true,
          req,
        });
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
