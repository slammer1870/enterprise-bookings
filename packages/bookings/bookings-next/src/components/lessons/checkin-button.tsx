"use client";

import { useTRPC } from "@repo/trpc/client";
import type { Lesson, LessonScheduleState } from "@repo/shared-types";
import { Button } from "@repo/ui/components/ui/button";
import type { MouseEventHandler } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useConfirm } from "@repo/ui/components/ui/use-confirm";

// Optional analytics - only used if available
let useAnalyticsTracker:
  | (() => { trackEvent: (event: string) => void })
  | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const analytics = require("@repo/analytics");
  useAnalyticsTracker = analytics.useAnalyticsTracker;
} catch {
  // Analytics package not available, that's okay
}

const labelByAction: Record<LessonScheduleState["action"], string> = {
  book: "Book",
  cancel: "Cancel Booking",
  modify: "Modify Booking",
  joinWaitlist: "Join Waitlist",
  leaveWaitlist: "Leave Waitlist",
  closed: "Closed",
  loginToBook: "Book",
  manageChildren: "Manage Children",
};

const classNameByAction: Record<LessonScheduleState["action"], string> = {
  book: "w-full bg-checkin hover:bg-checkin/90 text-checkin-foreground",
  cancel: "w-full bg-cancel hover:bg-cancel/90 text-cancel-foreground",
  modify: "w-full bg-checkin hover:bg-checkin/90 text-checkin-foreground",
  joinWaitlist: "w-full bg-waitlist hover:bg-waitlist/90 text-waitlist-foreground",
  leaveWaitlist: "w-full bg-cancel hover:bg-cancel/90 text-cancel-foreground",
  closed: "w-full bg-closed hover:bg-closed/90 text-closed-foreground opacity-50 cursor-not-allowed",
  loginToBook: "w-full bg-checkin hover:bg-checkin/90 text-checkin-foreground",
  manageChildren: "w-full bg-childrenBooked hover:bg-childrenBooked/90 text-childrenBooked-foreground",
};

export const CheckInButton = ({
  lessonId,
  type,
  scheduleState,
  manageHref,
}: {
  lessonId: number;
  type: Lesson["classOption"]["type"];
  scheduleState?: LessonScheduleState;
  manageHref?: string | ((lessonId: number) => string);
}) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const trackEvent = useAnalyticsTracker?.()?.trackEvent || (() => {});

  const [ConfirmationDialog, confirm] = useConfirm(
    "Are you sure you want to cancel this booking?",
    ""
  );

  const action: LessonScheduleState["action"] = scheduleState?.action ?? "book";
  const label = scheduleState?.label ?? labelByAction[action];

  const { mutateAsync: setMyBooking, isPending } = useMutation(
    trpc.bookings.setMyBookingForLesson.mutationOptions({
      onSuccess: async (result: any) => {
        // The schedule state is computed server-side; a single refetch gives consistent UI.
        await queryClient.invalidateQueries({
          queryKey: trpc.lessons.getByDate.queryKey(),
        });

        if (result?.redirectUrl) {
          router.push(result.redirectUrl);
        }
      },
    })
  );

  const handleClick: MouseEventHandler<HTMLButtonElement> = async () => {
    if (action === "closed") return;

    // Child lessons are handled via a dedicated booking page.
    if (action === "manageChildren" || type === "child") {
      router.push(`/bookings/children/${lessonId}`);
      return;
    }

    if (action === "loginToBook") {
      const isTrial = (label || "").toLowerCase().includes("trial");
      toast.info("Please sign in to continue");
      router.push(
        `/complete-booking?mode=${isTrial ? "register" : "login"}&callbackUrl=/bookings/${lessonId}`,
        { scroll: false }
      );
      return;
    }

    if (action === "modify") {
      if (manageHref) {
        const manageUrl = typeof manageHref === "function" ? manageHref(lessonId) : manageHref;
        router.push(manageUrl);
      } else {
        router.push(`/bookings/${lessonId}`);
      }
      trackEvent("Modify Booking Initiated");
      return;
    }

    if (action === "book") {
      router.push(`/bookings/${lessonId}`);
      trackEvent("Booking Initiated");
      return;
    }

    if (action === "cancel") {
      const ok = await confirm();
      if (!ok) return;
      await setMyBooking({ lessonId, intent: "cancel" });
      toast.success("Booking cancelled");
      return;
    }

    if (action === "joinWaitlist") {
      await setMyBooking({ lessonId, intent: "joinWaitlist" });
      toast.success("Joined waitlist");
      return;
    }

    if (action === "leaveWaitlist") {
      await setMyBooking({ lessonId, intent: "leaveWaitlist" });
      toast.success("Left waitlist");
      return;
    }
  };

  const disabled = action === "closed" || isPending;

  return (
    <>
      <ConfirmationDialog />
      <Button
        className={classNameByAction[action]}
        disabled={disabled}
        onClick={handleClick}
      >
        {isPending ? "Loading..." : label}
      </Button>
    </>
  );
};
