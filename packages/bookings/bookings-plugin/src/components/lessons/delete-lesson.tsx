"use client";

import { useConfirm } from "@repo/ui/components/ui/use-confirm";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export const DeleteLesson = ({ lessonId }: { lessonId: number }) => {
  const router = useRouter();
  const [ConfirmationDialog, confirm] = useConfirm(
    "Are you sure you want to delete this lesson",
    "Deleting this lesson will delete all associated bookings"
  );
  return (
    <>
      <div>
        <button
          className="bg-transparent text-red-500 p-2 cursor-pointer hover:bg-red-500 hover:text-white w-full text-left rounded-md outline-none border-0"
          onClick={async () => {
            const ok = await confirm();
            if (ok) {
              const response = await fetch(`/api/lessons/${lessonId}?depth=2`, {
                method: "DELETE",
                credentials: "include",
              });
              if (!response.ok) {
                const data = await response.json();
                toast.error(data.errors[0].message || "An error occurred");
                throw new Error(data.errors[0].message || "An error occurred");
              } else {
                toast.success("Lesson deleted successfully");
                router.refresh();
              }
            }
          }}
        >
          <Trash2 className="h-4 w-4" /> <span className="ml-2">Delete</span>
        </button>
      </div>
      <ConfirmationDialog />
    </>
  );
};
