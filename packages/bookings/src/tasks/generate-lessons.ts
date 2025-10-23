import { TaskHandler } from "payload";
import { addDays } from "date-fns";
import { TZDate } from "@date-fns/tz";

import { TaskGenerateLessonsFromSchedule } from "../types";
import { Lesson } from "@repo/shared-types";

export const generateLessonsFromSchedule: TaskHandler<
  "generateLessonsFromSchedule"
> = async ({ input, req }) => {
  const {
    startDate,
    endDate,
    week,
    clearExisting,
    defaultClassOption,
    lockOutTime,
  } = input as TaskGenerateLessonsFromSchedule["input"];

  const { payload } = req;

  if (!startDate || !endDate || !week) {
    return {
      output: {
        success: false,
        message: "Missing required parameters",
      },
    };
  }

  const timeZone =
    payload.config.admin.timezones.defaultTimezone || "Europe/Dublin";

  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0); // Set to earliest possible time (00:00:00.000)
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999); // Set to latest possible time (23:59:59.999)

  try {
    if (clearExisting) {
      payload.logger.info("Clearing existing lessons");
      try {
        // First find lessons that have no bookings
        const lessonQuery = await payload.find({
          collection: "lessons",
          where: {
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
          },
          depth: 4,
          limit: 0,
        });

        const lessons = lessonQuery.docs as Lesson[];

        let lessonsToNotDelete: number[] = [];
        // Filter lessons that have no bookings
        lessonsToNotDelete = lessons.reduce((acc: number[], lesson: Lesson) => {
          if (
            lesson.bookings?.docs?.some(
              (booking: any) => booking.status === "confirmed"
            )
          ) {
            acc.push(lesson.id);
          }
          return acc;
        }, []);

        await payload.delete({
          collection: "lessons",
          where: {
            id: {
              not_in: lessonsToNotDelete,
            },
          },
          context: {
            triggerAfterChange: false,
          },
        });
      } catch (error) {
        console.error("Error clearing existing lessons:", error);
      }
    }

    let currentDate = new Date(start);
    while (currentDate <= end) {
      const dayOfWeek = currentDate.getDay();

      // Find the corresponding day in the schedule
      const scheduleDay = week.days.find((day: any) => {
        return week.days.indexOf(day) === dayOfWeek - 1;
      });

      if (!scheduleDay || !scheduleDay.timeSlot) {
        currentDate = addDays(currentDate, 1);
        continue;
      }

      const timeSlots = scheduleDay.timeSlot;

      for (const timeSlot of timeSlots) {
        // Extract time components from the stored time slots
        // Note: timeSlot times are stored as ISO strings, so we need to parse them
        // in a way that preserves the intended wall-clock time (e.g., 7am = 7am)
        const startTimeDate = new Date(timeSlot.startTime);
        const endTimeDate = new Date(timeSlot.endTime);

        // Extract hours and minutes using UTC methods to avoid DST shifts
        // This ensures the wall-clock time (e.g., 7:00) is preserved
        const startHours = startTimeDate.getUTCHours();
        const startMinutes = startTimeDate.getUTCMinutes();
        const endHours = endTimeDate.getUTCHours();
        const endMinutes = endTimeDate.getUTCMinutes();

        // Use TZDate to create dates in the specified timezone
        // This ensures that times remain consistent across DST boundaries
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

        const existingLesson = await payload.find({
          collection: "lessons",
          where: {
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
          },
        });

        if (existingLesson.docs.length > 0) {
          continue;
        }

        // Create a timezone-aware date for the lesson date field
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
          },
        });
        console.log("New lesson", newLesson);
      }

      currentDate = addDays(currentDate, 1);
    }
  } catch (error) {
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
