import { BookingsCount } from "../bookings/bookings-count";

import { BookingList } from "../bookings/booking-list";

import {
  CollapsibleContent,
  CollapsibleTrigger,
  Collapsible,
} from "@repo/ui/components/ui/collapsible";

import { Lesson, Booking, ClassOption } from "../../types";

import { ManageLesson } from "./manage-lesson";

/* eslint-disable-next-line */

const options: Intl.DateTimeFormatOptions = {
  hour: "numeric",
  minute: "numeric",
};

export const LessonDetail = ({ lesson }: { lesson: Lesson }) => {
  console.log("deail is rendered");
  const bookings = lesson.bookings.docs as Booking[];
  const classOption = lesson.class_option as ClassOption;

  return (
    <Collapsible key={lesson.id}>
      <div>
        <div className="flex flex-row mb-4">
          <div className="w-1/6 text-gray-500">
            {new Date(lesson.start_time).toLocaleTimeString("en-GB", options)}
          </div>
          <div className="w-1/6">
            {new Date(lesson.end_time).toLocaleTimeString("en-GB", options)}
          </div>
          <div className="w-2/6">{/*<p>{classOption.name}</p>*/}</div>
          <div className="text-right w-1/6">
            <CollapsibleTrigger className="cursor-pointer bg-white">
              <BookingsCount count={bookings.length} />
            </CollapsibleTrigger>
          </div>
          <div className="text-right w-1/6 flex justify-end items-start">
            <ManageLesson lessonId={lesson.id} />
          </div>
        </div>
        <CollapsibleContent>
          <BookingList bookings={bookings} />
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

export default LessonDetail;
