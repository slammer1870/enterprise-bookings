"use client";

import { useTRPC } from "@repo/trpc/client";
import type { ScheduleTimeslot, TimeslotScheduleState } from "@repo/shared-types";
import { Button } from "@repo/ui/components/ui/button";
import type { MouseEventHandler } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useConfirm } from "@repo/ui/components/ui/use-confirm";

// Optional analytics - only used if available
let useAnalyticsTracker:
  | (() => { trackEvent: (_event: string) => void })
  | null = null;
try {
  const analytics = require("@repo/analytics");
  useAnalyticsTracker = analytics.useAnalyticsTracker;
} catch {
  // Analytics package not available, that's okay
}

const labelByAction: Record<TimeslotScheduleState["action"], string> = {
  book: "Book",
  cancel: "Cancel Booking",
  modify: "Modify Booking",
  joinWaitlist: "Join Waitlist",
  leaveWaitlist: "Leave Waitlist",
  closed: "Closed",
  loginToBook: "Book",
  manageChildren: "Manage Children",
};

const classNameByAction: Record<TimeslotScheduleState["action"], string> = {
  book: "w-full bg-checkin hover:bg-checkin/90 text-checkin-foreground",
  cancel: "w-full bg-cancel hover:bg-cancel/90 text-cancel-foreground",
  modify: "w-full bg-modify hover:bg-modify/90 text-modify-foreground",
  joinWaitlist: "w-full bg-waitlist hover:bg-waitlist/90 text-waitlist-foreground",
  leaveWaitlist: "w-full bg-cancel hover:bg-cancel/90 text-cancel-foreground",
  closed: "w-full bg-closed hover:bg-closed/90 text-closed-foreground opacity-50 cursor-not-allowed",
  loginToBook: "w-full bg-checkin hover:bg-checkin/90 text-checkin-foreground",
  manageChildren: "w-full bg-childrenBooked hover:bg-childrenBooked/90 text-childrenBooked-foreground",
};

export const CheckInButton = ({
  timeslotId,
  type,
  scheduleState,
  manageHref,
}: {
  timeslotId: number;
  type: ScheduleTimeslot["eventType"]["type"];
  scheduleState?: TimeslotScheduleState;
  /**
   * Optional function or string to generate the manage booking URL.
   * Defaults to `/bookings/[id]/manage` if not provided.
   */
  manageHref?: string | ((_timeslotId: number) => string);
}) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const trackEvent = useAnalyticsTracker?.()?.trackEvent || (() => {});

  const [ConfirmationDialog, confirm] = useConfirm(
    "Are you sure you want to cancel this booking?",
    ""
  );

  const action: TimeslotScheduleState["action"] = scheduleState?.action ?? "book";
  const label = scheduleState?.label ?? labelByAction[action];
  const isTrialBooking = label.toLowerCase().includes("trial");

  const { mutateAsync: setMyBooking, isPending } = useMutation(
    trpc.bookings.setMyBookingForTimeslot.mutationOptions({
      onSuccess: async (result: any) => {
        // The schedule state is computed server-side; a single refetch gives consistent UI.
        await queryClient.invalidateQueries({
          queryKey: trpc.timeslots.getByDate.queryKey(),
        });

        if (result?.redirectUrl) {
          router.push(result.redirectUrl);
        }
      },
    })
  );

  const { mutateAsync: bookSingleSlotOrRedirect, isPending: isSingleSlotPending } = useMutation(
    trpc.bookings.bookSingleSlotTimeslotOrRedirect.mutationOptions({
      onSuccess: async (result: any) => {
        await queryClient.invalidateQueries({
          queryKey: trpc.timeslots.getByDate.queryKey(),
        });
        if (result?.redirectUrl) {
          router.push(result.redirectUrl);
        }
      },
    })
  );

  const handleClick: MouseEventHandler<HTMLButtonElement> = async () => {
    if (action === "closed") return;

    // Child timeslots are handled via a dedicated booking page.
    if (action === "manageChildren" || type === "child") {
      router.push(`/bookings/children/${timeslotId}`);
      return;
    }

    if (action === "loginToBook") {
      const isTrial = (label || "").toLowerCase().includes("trial");
      toast.info("Please sign in to continue");
      router.push(
        `/complete-booking?mode=${isTrial ? "register" : "login"}&callbackUrl=/bookings/${timeslotId}`,
        { scroll: false }
      );
      return;
    }

    if (action === "modify") {
      // Default to /bookings/[id]/manage if no custom manageHref is provided
      const defaultManageUrl = `/bookings/${timeslotId}/manage`;
      const manageUrl = manageHref 
        ? (typeof manageHref === "function" ? manageHref(timeslotId) : manageHref)
        : defaultManageUrl;
      router.push(manageUrl);
      trackEvent("Modify Booking Initiated");
      return;
    }

    if (action === "book") {
      const singleSlotOnly = scheduleState?.singleSlotOnly === true;
      if (singleSlotOnly) {
        const result = await bookSingleSlotOrRedirect({ timeslotId });
        // Only show "Booked" when the server actually booked immediately.
        // If we got a redirectUrl, the user is being sent to a booking/manage page (payment/portal),
        // so showing a success toast is misleading.
        if (result?.redirectUrl == null) {
          toast.success("Booked");
        }
      } else {
        router.push(`/bookings/${timeslotId}`);
      }
      trackEvent("Booking Initiated");
      return;
    }

    if (action === "cancel") {
      const ok = await confirm();
      if (!ok) return;
      await setMyBooking({ timeslotId, intent: "cancel" });
      toast.success("Booking cancelled");
      return;
    }

    if (action === "joinWaitlist") {
      await setMyBooking({ timeslotId, intent: "joinWaitlist" });
      toast.success("Joined waitlist");
      return;
    }

    if (action === "leaveWaitlist") {
      await setMyBooking({ timeslotId, intent: "leaveWaitlist" });
      toast.success("Left waitlist");
      return;
    }
  };

  const disabled = action === "closed" || isPending || isSingleSlotPending;

  return (
    <>
      <ConfirmationDialog />
      <Button
        className={
          isTrialBooking
            ? "w-full bg-trialable hover:bg-trialable/90 text-trialable-foreground"
            : classNameByAction[action]
        }
        disabled={disabled}
        onClick={handleClick}
      >
        {isPending || isSingleSlotPending ? "Loading..." : label}
      </Button>
    </>
  );
};
