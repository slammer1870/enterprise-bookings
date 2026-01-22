import { addDays } from "date-fns";
import { TZDate } from "@date-fns/tz";

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

  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

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

    let currentDate = new Date(start);
    while (currentDate <= end) {
      const dayOfWeek = currentDate.getDay();
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

        const startInTZ = new TZDate(startTimeDate, timeZone);
        const endInTZ = new TZDate(endTimeDate, timeZone);

        const startHours = startInTZ.getHours();
        const startMinutes = startInTZ.getMinutes();
        const endHours = endInTZ.getHours();
        const endMinutes = endInTZ.getMinutes();

        const lessonStartTime = new TZDate(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          currentDate.getDate(),
          startHours,
          startMinutes,
          0,
          0,
          timeZone
        );

        const lessonEndTime = new TZDate(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          currentDate.getDate(),
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
          currentDate.getFullYear(),
          currentDate.getMonth(),
          currentDate.getDate(),
          0,
          0,
          0,
          0,
          timeZone
        );

        const newLesson = await payload.create({
          collection: "lessons",
          data: {
            date: lessonDate.toISOString(),
            startTime: lessonStartTime.toISOString(),
            endTime: lessonEndTime.toISOString(),
            classOption:
              Number(timeSlot.classOption) || Number(defaultClassOption),
            location: timeSlot.location || null,
            instructor: Number(timeSlot.instructor) || null,
            lockOutTime: Number(timeSlot.lockOutTime) || Number(lockOutTime),
            active: timeSlot.active || true,
            ...(tenantId ? { tenant: tenantId } : {}),
          },
        });

        // eslint-disable-next-line no-console
        console.log("New lesson", newLesson);
      }

      currentDate = addDays(currentDate, 1);
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

