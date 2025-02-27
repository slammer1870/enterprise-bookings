import { Lesson } from "@repo/shared-types";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@repo/ui/components/ui/card";

export function BookingForm(props: { lesson: Lesson; name: string }) {
  const { lesson, name } = props;

  return (
    <>
      <Card>
        <CardHeader className="text-2xl">Your booking information</CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col items-start">
              <p className="text-lg font-medium mb-1">Attendee</p>
              <span>{name}</span>
            </div>
            <div className="flex flex-col items-start">
              <p className="text-lg font-medium mb-1">Booking type</p>
              <span>{lesson.classOption.name}</span>
            </div>
            <div className="flex flex-col items-start">
              <p className="text-lg font-medium mb-1">Date</p>
              <span>{new Date(lesson.startTime).toDateString()}</span>
            </div>
            <div className="flex flex-col items-start">
              <p className="text-lg font-medium mb-1">Time</p>
              <span>
                {format(new Date(lesson.startTime), "HH:mm aa")} -{" "}
                {format(new Date(lesson.endTime), "HH:mm aa")}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
