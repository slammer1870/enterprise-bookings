import { Button } from "@repo/ui/components/ui/button";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";

import { MoreHorizontal, Edit2Icon } from "lucide-react";

import Link from "next/link";

import { DeleteLesson } from "./delete-lesson";

export const ManageLesson = ({ lessonId }: { lessonId: number }) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-10 w-6 p-0 bg-transparent">
          <span className="sr-only">Open menu</span>
          <MoreHorizontal className="h-6 w-6" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-50 w-[160px]">
        <DropdownMenuItem className="font-base group flex w-full items-center  justify-between p-0 text-left text-sm text-neutral-500 ">
          <Link
            href={`/admin/collections/lessons/${lessonId}`}
            className="flex w-full items-center justify-start rounded-md p-2 transition-all duration-75 hover:bg-neutral-100"
          >
            <Edit2Icon className="h-4 w-4" />
            <span className="ml-2 no-underline">Edit</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="font-base group flex w-full items-center  justify-between p-0 text-left text-sm text-neutral-500"
          asChild
        >
          <DeleteLesson lessonId={lessonId} />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
