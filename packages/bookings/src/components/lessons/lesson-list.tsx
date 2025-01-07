import { Lesson } from "../../types";
import { LessonDetail } from "./lesson-detail";

export const LessonList: React.FC<{ lessons: Lesson[] }> = ({ lessons }) => {
  console.log(lessons);
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
              <div key={lesson.id}>
                <div>{lesson.bookings.docs.length}</div>
                <LessonDetail lesson={lesson} />
              </div>
            ))
          ) : (
            <span>No classes for today</span>
          )}
        </div>
      </div>
    </div>
  );
};
