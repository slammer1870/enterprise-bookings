"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Button } from "@payloadcms/ui";
import { DropdownMenuItem } from "@repo/ui/components/ui/dropdown-menu";

export const DeleteLesson = ({ lessonId }: { lessonId: number }) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleConfirm = async () => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/lessons/${lessonId}?depth=2`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        toast.error(data.errors?.[0]?.message ?? "An error occurred");
        return;
      }

      toast.success("Lesson deleted successfully");
      setOpen(false);
      router.refresh();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <DropdownMenuItem
        className="text-destructive focus:text-destructive"
        onSelect={(e) => {
          e.preventDefault();
          setOpen(true);
        }}
      >
        <Trash2 className="h-4 w-4" />
        Delete
      </DropdownMenuItem>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete lesson?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this lesson? Deleting will remove
              all associated bookings.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              buttonStyle="secondary"
              size="small"
              onClick={() => setOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              buttonStyle="error"
              size="small"
              onClick={handleConfirm}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
