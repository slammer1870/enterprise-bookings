import { CalendarIcon, Clock, ClipboardCheck } from "lucide-react";

import type { Lesson } from "@repo/shared-types";
import {
  formatDateInTimeZone,
  formatInTimeZone,
  resolveLessonTimeZone,
} from "@repo/shared-utils";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";

export function BookingSummary({ lesson }: { lesson: Lesson }) {
  const timeZone = resolveLessonTimeZone(lesson);

  return (
    <Card className="bg-white">
      <CardHeader>
        <CardTitle>Booking Summary</CardTitle>
        <CardDescription>Review your booking summary details</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3">
          <div className="flex items-center">
            <CalendarIcon className="h-5 w-5 mr-2 text-primary" />
            <span className="font-medium">Date:</span>
            <span className="ml-2">
              {formatDateInTimeZone(lesson.date, "en-US", timeZone, {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>

          <div className="flex items-center">
            <Clock className="h-5 w-5 mr-2 text-primary" />
            <span className="font-medium">Time:</span>
            <span className="ml-2">
              {formatInTimeZone(lesson.startTime, "HH:mmaa", timeZone)} -{" "}
              {formatInTimeZone(lesson.endTime, "HH:mmaa", timeZone)}
            </span>
          </div>

          <div className="flex items-center">
            <ClipboardCheck className="h-5 w-5 mr-2 text-primary" />
            <span className="font-medium">Booking Type:</span>
            <span className="ml-2">
              {(lesson.classOption as { name?: string } | null | undefined)?.name ?? "—"}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

