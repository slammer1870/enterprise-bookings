"use client";

import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  TableCell,
} from "@repo/ui/components/ui/table";

/**
 * Loading skeleton for the lessons list. Uses shadcn Table.
 */
export const LessonLoading: React.FC<{}> = () => {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10" />
          <TableHead>Start Time</TableHead>
          <TableHead>End Time</TableHead>
          <TableHead>Class Name</TableHead>
          <TableHead>Bookings</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell colSpan={6} className="text-center">
            Loading lessons...
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
};
