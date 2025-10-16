import { TaskHandler } from "payload";
import { addDays } from "date-fns";

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
        // TODO: TEst daylight savings time

        const startTime = new Date(timeSlot.startTime);
        const endTime = new Date(timeSlot.endTime);

        const lessonStartTime = new Date(currentDate);
        lessonStartTime.setHours(startTime.getHours());
        lessonStartTime.setMinutes(startTime.getMinutes());
        lessonStartTime.setSeconds(0);
        lessonStartTime.setMilliseconds(0);

        const lessonEndTime = new Date(currentDate);
        lessonEndTime.setHours(endTime.getHours());
        lessonEndTime.setMinutes(endTime.getMinutes());
        lessonEndTime.setSeconds(0);
        lessonEndTime.setMilliseconds(0);

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

        const newLesson = await payload.create({
          collection: "lessons",
          data: {
            date: currentDate.toISOString(),
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
