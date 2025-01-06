//import LessonDetail from "./LessonDetail";

import { Lesson } from "../types";

export const LessonList: React.FC<{ lessons: Lesson[] }> = ({ lessons }) => {
  return (
    <div className="w-full">
      <div className="flex flex-col">
        <div className="flex flex-row mb-4">
          <div className="w-1/6">Start Time</div>
          <div className="w-1/6">End Time</div>
          <div className="w-2/6">Class Type</div>
          <div className="text-right w-1/6">Bookings</div>
          <div className="text-right w-1/6">Action</div>
        </div>
        <div className="flex flex-col gap-4">
          {lessons && lessons.length > 0 ? (
            lessons.map((lesson: Lesson) => (
              <p>hello</p>
              /*<LessonDetail key={lesson.id} lesson={lesson} />*/
            ))
          ) : (
            <span>No classes for today</span>
          )}
        </div>
      </div>
    </div>
  );
};
