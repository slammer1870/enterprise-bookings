import { Lesson } from "@repo/shared-types";

import { LessonDetail } from "./lesson-detail";

import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@repo/ui/components/ui/table";

export const LessonList: React.FC<{
  lessons: Lesson[];
}> = ({ lessons }) => {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Start Time</TableHead>
          <TableHead>End Time</TableHead>
          <TableHead>Class Name</TableHead>
          <TableHead>Bookings</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lessons && lessons.length > 0 ? (
          lessons.map((lesson: Lesson) => (
            <LessonDetail lesson={lesson} key={lesson.id} />
          ))
        ) : (
          <TableRow>
            <TableCell colSpan={5} className="text-center">
              No classes for today
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
};
