"use client";

import { useTRPC } from "@repo/trpc/client";

import { Booking, Lesson } from "@repo/shared-types";
import { Button, buttonVariants } from "@repo/ui/components/ui/button";
import type { ComponentProps, MouseEventHandler } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@repo/auth-next";

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

export const CheckInButton = ({
  bookingStatus,
  type,
  id,
}: {
  bookingStatus: Lesson["bookingStatus"];
  type: Lesson["classOption"]["type"];
  id: Booking["id"];
}) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { user } = useAuth();
  const trackEvent = useAnalyticsTracker?.()?.trackEvent || (() => {});

  const [ConfirmationDialog, confirm] = useConfirm(
    "Are you sure you want to cancel this booking?",
    ""
  );

  const requireAuth = (action: () => void) => {
    if (!user) {
      if (bookingStatus === "trialable") {
        toast.info("Please sign in to continue");
        return router.push(`/auth/sign-up?callbackUrl=/bookings/${id}`);
      }
      toast.info("Please sign in to continue");
      return router.push(`/auth/sign-in?callbackUrl=/bookings/${id}`);
    }
    action();
  };

  const handleUnifiedCheckIn = async () => {
    // Centralized check-in flow - let the server handle all business logic
    try {
      await checkInMutation({ lessonId: id });

      // If successful, user was checked in
    } catch (error: any) {
      // Handle specific redirect cases based on server response
      if (error.message === "REDIRECT_TO_CHILDREN_BOOKING") {
        const redirectUrl =
          error.data?.cause?.redirectUrl || `/bookings/children/${id}`;
        router.push(redirectUrl);
      } else if (error.message === "REDIRECT_TO_BOOKING_PAYMENT") {
        const redirectUrl = error.data?.cause?.redirectUrl || `/bookings/${id}`;
        toast.info("Please complete your booking to check in");
        router.push(redirectUrl);
      } else {
        // Generic error handling
        toast.error("Failed to check in. Please try again.");
        console.error("Check-in error:", error);
      }
    }
  };

  const { mutateAsync: checkInMutation, isPending: isCheckingIn } = useMutation(
    trpc.bookings.checkIn.mutationOptions({
      onSuccess: () => {
        toast.success("Checked in successfully!");
        queryClient.invalidateQueries({
          queryKey: trpc.lessons.getByDate.queryKey(),
        });
      },
      onError: (error) => {
        console.error("Check-in error:", error);
      },
    })
  );

  const { mutateAsync: createOrUpdateBooking, isPending: isCreatingBooking } =
    useMutation(
      trpc.bookings.createOrUpdateBooking.mutationOptions({
        onError: (error) => {
          console.error("Booking error:", error);
        },
      })
    );

  const { mutate: cancelBooking, isPending: isCancellingBooking } = useMutation(
    trpc.bookings.cancelBooking.mutationOptions({
      onSuccess: () => {
        toast.success("Booking cancelled");
        queryClient.invalidateQueries({
          queryKey: trpc.lessons.getByDate.queryKey(),
        });
      },
    })
  );

  const { mutate: joinWaitlist, isPending: isJoiningWaitlist } = useMutation(
    trpc.bookings.joinWaitlist.mutationOptions({
      onSuccess: () => {
        toast.success("Joined waitlist");
        queryClient.invalidateQueries({
          queryKey: trpc.lessons.getByDate.queryKey(),
        });
      },
    })
  );

  const { mutate: leaveWaitlist, isPending: isLeavingWaitlist } = useMutation(
    trpc.bookings.leaveWaitlist.mutationOptions({
      onSuccess: () => {
        toast.success("Left waitlist");
        queryClient.invalidateQueries({
          queryKey: trpc.lessons.getByDate.queryKey(),
        });
      },
    })
  );

  const getButtonClassName = (status: Lesson["bookingStatus"]) => {
    const baseClasses = "w-full";

    switch (status) {
      case "active":
        return `${baseClasses} bg-checkin hover:bg-checkin/90 text-checkin-foreground`;
      case "trialable":
        return `${baseClasses} bg-trialable hover:bg-trialable/90 text-trialable-foreground`;
      case "booked":
      case "waiting":
        return `${baseClasses} bg-cancel hover:bg-cancel/90 text-cancel-foreground`;
      case "waitlist":
        return `${baseClasses} bg-waitlist hover:bg-waitlist/90 text-waitlist-foreground`;
      case "childrenBooked":
        return `${baseClasses} bg-childrenBooked hover:bg-childrenBooked/90 text-childrenBooked-foreground`;
      case "closed":
        return `${baseClasses} bg-closed hover:bg-closed/90 text-closed-foreground opacity-50 cursor-not-allowed`;
      default:
        return baseClasses;
    }
  };

  const config: Record<
    Lesson["bookingStatus"],
    {
      label: string;
      childLabel?: string;
      variant: ComponentProps<typeof Button>["variant"];
      className: string;
      disabled: boolean;
      action: () => void;
    }
  > = {
    active: {
      label: isCheckingIn
        ? "Checking In..."
        : type === "child"
          ? "Check Child In"
          : "Check In",
      variant: "default" as const,
      className: getButtonClassName("active"),
      disabled: isCheckingIn,
      action: () =>
        requireAuth(() => {
          handleUnifiedCheckIn();
          trackEvent("Check In Initiated");
        }),
    },
    booked: {
      label: isCancellingBooking ? "Cancelling..." : "Cancel Booking",
      variant: "default" as const,
      className: getButtonClassName("booked"),
      disabled: isCancellingBooking,
      action: () =>
        requireAuth(() => {
          confirm().then((result) => {
            if (result) {
              cancelBooking({ id });
            }
          });
        }),
    },
    trialable: {
      label: isCheckingIn ? "Booking..." : "Book Trial Class",
      variant: "default" as const,
      className: getButtonClassName("trialable"),
      disabled: isCheckingIn,
      action: () =>
        requireAuth(() => {
          handleUnifiedCheckIn();
          trackEvent("Trial Class Booking Initiated");
        }),
    },
    waitlist: {
      label: isJoiningWaitlist ? "Joining..." : "Join Waitlist",
      variant: "default" as const,
      className: getButtonClassName("waitlist"),
      disabled: isJoiningWaitlist,
      action: () =>
        requireAuth(() => {
          joinWaitlist({ id });
        }),
    },
    waiting: {
      label: isLeavingWaitlist ? "Leaving..." : "Leave Waitlist",
      variant: "default" as const,
      className: getButtonClassName("waiting"),
      disabled: isLeavingWaitlist,
      action: () =>
        requireAuth(() => {
          leaveWaitlist({ id });
        }),
    },
    childrenBooked: {
      label: isCheckingIn ? "Loading..." : "Manage Children",
      variant: "default" as const,
      className: getButtonClassName("childrenBooked"),
      disabled: isCheckingIn,
      action: () => requireAuth(() => handleUnifiedCheckIn()),
    },
    closed: {
      label: "Closed",
      variant: "default" as const,
      className: getButtonClassName("closed"),
      disabled: true,
      action: () => {
        toast.error("Lesson is closed");
      },
    },
  } as const;

  return (
    <>
      <ConfirmationDialog />
      <Button
        variant={config[bookingStatus].variant}
        className={config[bookingStatus].className}
        disabled={config[bookingStatus].disabled}
        onClick={
          config[bookingStatus].action as MouseEventHandler<HTMLButtonElement>
        }
      >
        {config[bookingStatus].label}
      </Button>
    </>
  );
};
