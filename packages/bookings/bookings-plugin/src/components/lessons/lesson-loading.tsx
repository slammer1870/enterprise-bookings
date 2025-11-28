import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@repo/ui/components/ui/table";

export const LessonLoading: React.FC<{}> = () => {
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
        <TableRow>
          <TableCell colSpan={5} className="text-center">
            Loading lessons...
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
};
