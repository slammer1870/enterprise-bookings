import { addDays } from "date-fns";
import { TZDate } from "@date-fns/tz";

/** Normalize relationship value to ID (handles populated { id } or raw number). */
function toId(value) {
  if (value == null) return null;
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  if (typeof value === "object" && value !== null && "id" in value) {
    const id = value.id;
    return typeof id === "number" ? id : null;
  }
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

/**
 * Runtime JS entrypoint for Node/Next environments that cannot import `.ts` files
 * from workspace packages via deep imports (e.g. `@repo/bookings-plugin/src/...`).
 *
 * The TypeScript source of truth remains `generate-lessons.ts`.
 *
 * @param {{ input: any, req: any }} args
 * @returns {Promise<{ output: { success: boolean, message: string } }>}
 */
export const generateLessonsFromSchedule = async ({ input, req }) => {
  const {
    startDate,
    endDate,
    week,
    clearExisting,
    defaultClassOption,
    lockOutTime,
  } = input ?? {};

  const { payload } = req ?? {};

  if (!startDate || !endDate || !week) {
    return {
      output: {
        success: false,
        message: "Missing required parameters",
      },
    };
  }

  const timeZone =
    payload?.config?.admin?.timezones?.defaultTimezone || "Europe/Dublin";

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

  try {
    if (clearExisting) {
      payload?.logger?.info?.("Clearing existing lessons");
      try {
        // `req.context.tenant` may be a primitive ID or an object with an `id` field
        const rawTenant = req?.context?.tenant;
        const tenantId =
          rawTenant &&
          typeof rawTenant === "object" &&
          rawTenant !== null &&
          "id" in rawTenant
            ? rawTenant.id
            : rawTenant;

        const whereClause = {
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
          ],
        };

        if (tenantId) {
          whereClause.and.push({
            tenant: {
              equals: tenantId,
            },
          });
        }

        const lessonQuery = await payload.find({
          collection: "lessons",
          where: whereClause,
          depth: 4,
          limit: 0,
        });

        const lessons = lessonQuery?.docs || [];

        const lessonsToNotDelete = lessons.reduce((acc, lesson) => {
          const hasConfirmed = lesson?.bookings?.docs?.some(
            (booking) => booking?.status === "confirmed"
          );
          if (hasConfirmed && lesson?.id != null) acc.push(lesson.id);
          return acc;
        }, []);

        const deleteWhereClause = {
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
                not_in: lessonsToNotDelete,
              },
            },
          ],
        };

        if (tenantId) {
          deleteWhereClause.and.push({
            tenant: {
              equals: tenantId,
            },
          });
        }

        await payload.delete({
          collection: "lessons",
          where: deleteWhereClause,
          context: {
            triggerAfterChange: false,
          },
        });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error clearing existing lessons:", error);
      }
    }

    // `req.context.tenant` may be a primitive ID or an object with an `id` field
    const rawTenant = req?.context?.tenant;
    const tenantId =
      rawTenant &&
      typeof rawTenant === "object" &&
      rawTenant !== null &&
      "id" in rawTenant
        ? rawTenant.id
        : rawTenant;

    // IMPORTANT: Keep `currentDate` as a timezone-aware date.
    // Converting to a plain `Date` and then reading Y/M/D via getters will use the
    // server timezone (often UTC) and can shift the calendar day after DST starts.
    let currentDate = start;
    while (currentDate <= end) {
      const currentInTZ = new TZDate(currentDate, timeZone);

      // Derive weekday in the scheduler's timezone (NOT server timezone),
      // otherwise we can map "Monday" slots onto "Sunday" when DST shifts.
      const dayOfWeek = currentInTZ.getDay();
      const scheduleIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const scheduleDay = week?.days?.[scheduleIndex];

      if (!scheduleDay || !scheduleDay.timeSlot) {
        currentDate = addDays(currentDate, 1);
        continue;
      }

      const timeSlots = scheduleDay.timeSlot;

      for (const timeSlot of timeSlots) {
        const startTimeDate = new Date(timeSlot.startTime);
        const endTimeDate = new Date(timeSlot.endTime);

        // `timeSlot.startTime`/`endTime` are stored as absolute instants on a dummy
        // anchor date for time-only fields. Extracting UTC components keeps the
        // intended wall-clock slot stable across DST transitions and avoids local
        // timezone effects during parsing.
        const startHours = startTimeDate.getUTCHours();
        const startMinutes = startTimeDate.getUTCMinutes();
        const endHours = endTimeDate.getUTCHours();
        const endMinutes = endTimeDate.getUTCMinutes();

        const lessonStartTime = new TZDate(
          currentInTZ.getFullYear(),
          currentInTZ.getMonth(),
          currentInTZ.getDate(),
          startHours,
          startMinutes,
          0,
          0,
          timeZone
        );

        const lessonEndTime = new TZDate(
          currentInTZ.getFullYear(),
          currentInTZ.getMonth(),
          currentInTZ.getDate(),
          endHours,
          endMinutes,
          0,
          0,
          timeZone
        );

        const existingLessonWhere = {
          and: [
            {
              startTime: {
                greater_than_equal: lessonStartTime.toISOString(),
              },
            },
            {
              endTime: {
                less_than_equal: lessonEndTime.toISOString(),
              },
            },
            {
              location: {
                equals: timeSlot.location,
              },
            },
          ],
        };

        if (tenantId) {
          existingLessonWhere.and.push({
            tenant: {
              equals: tenantId,
            },
          });
        }

        const existingLesson = await payload.find({
          collection: "lessons",
          where: existingLessonWhere,
        });

        if (existingLesson?.docs?.length > 0) {
          continue;
        }

        const lessonDate = new TZDate(
          currentInTZ.getFullYear(),
          currentInTZ.getMonth(),
          currentInTZ.getDate(),
          0,
          0,
          0,
          0,
          timeZone
        );

        const defaultClassOptionId = toId(defaultClassOption);
        const classOptionId = toId(timeSlot.classOption) ?? defaultClassOptionId;
        if (classOptionId == null) {
          payload?.logger?.warn?.(
            `Skipping lesson: no valid classOption for slot ${timeSlot.startTime}`
          );
          continue;
        }
        const classOptionIdNum =
          typeof classOptionId === "number" && !Number.isNaN(classOptionId)
            ? classOptionId
            : Number(classOptionId);
        if (Number.isNaN(classOptionIdNum)) {
          payload?.logger?.warn?.(
            `Skipping lesson: classOption id is not a valid number for slot ${timeSlot.startTime}`
          );
          continue;
        }

        await payload.create({
          collection: "lessons",
          data: {
            date: lessonDate.toISOString(),
            startTime: lessonStartTime.toISOString(),
            endTime: lessonEndTime.toISOString(),
            classOption: classOptionIdNum,
            location: timeSlot.location || null,
            instructor: toId(timeSlot.instructor) ?? undefined,
            lockOutTime: Number(timeSlot.lockOutTime) || Number(lockOutTime),
            active: timeSlot.active !== false,
            ...(tenantId ? { tenant: tenantId } : {}),
          },
          context: {
            ...(req && req.context ? req.context : {}),
            skipLessonTimeNormalization: true,
          },
          req,
          overrideAccess: true,
        });
      }

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
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error generating lessons:", error);
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
      message: "Lessons generated successfully",
    },
  };
};

