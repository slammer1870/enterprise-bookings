"use client";

import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { Edit2Icon, Link2Icon, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { DeleteLesson } from "./delete-lesson";

/**
 * Actions dropdown for a lesson row. Uses a native button as trigger so Radix
 * can attach ref and open the menu (Payload Button does not forward ref).
 */
export const ManageLesson = ({ lessonId }: { lessonId: number }) => {
  const handleCopyBookingLink = async () => {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/bookings/${lessonId}`
        : "";
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Booking link copied to clipboard");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border-0 bg-transparent text-current hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          aria-label="Open menu"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-[100]">
        <DropdownMenuItem asChild>
          <Link
            href={`/admin/collections/lessons/${lessonId}`}
            className="flex items-center gap-2"
          >
            <Edit2Icon className="h-4 w-4" />
            Edit
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCopyBookingLink}>
          <Link2Icon className="h-4 w-4" />
          Share booking link
        </DropdownMenuItem>
        <div className="border-t border-border my-1" />
        <DeleteLesson lessonId={lessonId} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
