"use client";

import { useTRPC } from "@repo/trpc/client";

import { Booking, Lesson } from "@repo/shared-types";
import { Button, buttonVariants } from "@repo/ui/components/ui/button";
import type { ComponentProps, MouseEventHandler } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@repo/auth-next";
import { useState, useEffect, useRef } from "react";

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
  const pathname = usePathname();

  const trackEvent = useAnalyticsTracker?.()?.trackEvent || (() => {});

  // Loading state for navigation redirects
  const [isNavigating, setIsNavigating] = useState(false);
  const navigationStartPathname = useRef<string | null>(null);
  const navigationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [ConfirmationDialog, confirm] = useConfirm(
    "Are you sure you want to cancel this booking?",
    ""
  );

  const { data: session } = useQuery(trpc.auth.getSession.queryOptions());

  // Check if user has multiple bookings for this lesson
  // Only check when user is authenticated and lesson status allows booking
  const { data: userBookings } = useQuery({
    ...trpc.bookings.getUserBookingsForLesson.queryOptions({ lessonId: id }),
    enabled: !!session && (bookingStatus === "booked" || bookingStatus === "active"),
  });

  const hasMultipleBookings = (userBookings?.length || 0) > 1;

  // Reset navigation state if user is still on the same page after navigation was attempted
  // This handles cases where the modal is closed and navigation doesn't complete
  useEffect(() => {
    if (isNavigating) {
      // Store the pathname when navigation starts
      if (!navigationStartPathname.current) {
        navigationStartPathname.current = pathname;
      }

      // Set a timeout to reset if we're still on the same page after a delay
      // This handles the case where the modal is closed (router.back()) but the pathname
      // might not change immediately due to intercepting routes
      navigationTimeoutRef.current = setTimeout(() => {
        if (pathname === navigationStartPathname.current) {
          // Still on the same page, navigation was likely cancelled (e.g., modal closed)
          setIsNavigating(false);
          navigationStartPathname.current = null;
        }
      }, 500); // Delay to allow navigation to complete or detect cancellation

      // Cleanup timeout
      return () => {
        if (navigationTimeoutRef.current) {
          clearTimeout(navigationTimeoutRef.current);
          navigationTimeoutRef.current = null;
        }
      };
    } else {
      // Reset the ref when not navigating
      navigationStartPathname.current = null;
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
        navigationTimeoutRef.current = null;
      }
    }
  }, [isNavigating, pathname]);

  // Reset navigation state when pathname changes (navigation completed successfully)
  useEffect(() => {
    if (isNavigating && navigationStartPathname.current && pathname !== navigationStartPathname.current) {
      // Navigation completed successfully - pathname changed
      setIsNavigating(false);
      navigationStartPathname.current = null;
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
        navigationTimeoutRef.current = null;
      }
    }
  }, [pathname, isNavigating]);

  // Listen for popstate events (browser back/forward or router.back())
  // This helps detect when the modal is closed via router.back()
  useEffect(() => {
    const handlePopState = () => {
      if (isNavigating) {
        // User navigated back, likely closed the modal
        setIsNavigating(false);
        navigationStartPathname.current = null;
        if (navigationTimeoutRef.current) {
          clearTimeout(navigationTimeoutRef.current);
          navigationTimeoutRef.current = null;
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isNavigating]);

  const handleAuthRedirect = () => {
    setIsNavigating(true);
    // Invalidate session query to ensure UI updates properly
    queryClient.invalidateQueries({
      queryKey: trpc.auth.getSession.queryKey(),
    });
    
    if (bookingStatus === "trialable") {
      toast.info("Please sign in to continue");
      router.push(
        `/complete-booking?mode=register&callbackUrl=/bookings/${id}`,
        { scroll: false }
      );
    } else {
      toast.info("Please sign in to continue");
      router.push(
        `/complete-booking?mode=login&callbackUrl=/bookings/${id}`,
        { scroll: false }
      );
    }
  };

  const requireAuth = (action: () => void) => {
    if (!session) {
      handleAuthRedirect();
      return;
    }
    action();
  };

  const handleUnifiedCheckIn = async () => {
    // Centralized check-in flow - let the server handle all business logic
    try {
      await checkInMutation({ lessonId: id });

      // If successful, user was checked in
    } catch (error: any) {
      // Handle authentication errors - redirect to login
      if (error.data?.code === "UNAUTHORIZED" || error.message?.includes("logged in")) {
        handleAuthRedirect();
        return;
      }
      
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

  const { mutate: cancelBooking, isPending: isCancellingBooking } = useMutation(
    trpc.bookings.cancelBooking.mutationOptions({
      onSuccess: () => {
        toast.success("Booking cancelled");
        queryClient.invalidateQueries({
          queryKey: trpc.lessons.getByDate.queryKey(),
        });
      },
      onError: (error: any) => {
        // Handle authentication errors
        if (error.data?.code === "UNAUTHORIZED" || error.message?.includes("logged in")) {
          handleAuthRedirect();
        } else {
          toast.error("Failed to cancel booking. Please try again.");
          console.error("Cancel booking error:", error);
        }
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
      onError: (error: any) => {
        // Handle authentication errors
        if (error.data?.code === "UNAUTHORIZED" || error.message?.includes("logged in")) {
          handleAuthRedirect();
        } else {
          toast.error("Failed to join waitlist. Please try again.");
          console.error("Join waitlist error:", error);
        }
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
      onError: (error: any) => {
        // Handle authentication errors
        if (error.data?.code === "UNAUTHORIZED" || error.message?.includes("logged in")) {
          handleAuthRedirect();
        } else {
          toast.error("Failed to leave waitlist. Please try again.");
          console.error("Leave waitlist error:", error);
        }
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
      label: hasMultipleBookings
        ? isNavigating
          ? "Loading..."
          : "Modify Booking"
        : isCheckingIn
          ? "Checking In..."
          : isNavigating
            ? "Loading..."
            : type === "child"
              ? "Check Child In"
              : "Book",
      variant: "default" as const,
      className: getButtonClassName("active"),
      disabled: isCheckingIn || isNavigating,
      action: () =>
        requireAuth(() => {
          setIsNavigating(true);
          if (hasMultipleBookings) {
            // Redirect to booking management page
            router.push(`/bookings/${id}/manage`);
            trackEvent("Modify Booking Initiated");
          } else {
            // MVP: Always redirect to booking page instead of direct check-in
            router.push(`/bookings/${id}`);
            trackEvent("Booking Initiated");
          }
        }),
    },
    booked: {
      label: hasMultipleBookings
        ? isNavigating
          ? "Loading..."
          : "Modify Booking"
        : isCancellingBooking
          ? "Cancelling..."
          : "Cancel Booking",
      variant: "default" as const,
      className: getButtonClassName("booked"),
      disabled: isCancellingBooking || isNavigating,
      action: () =>
        requireAuth(() => {
          if (hasMultipleBookings) {
            setIsNavigating(true);
            // Redirect to booking management page
            router.push(`/bookings/${id}/manage`);
            trackEvent("Modify Booking Initiated");
          } else {
            // When user has exactly one booking, cancel that specific booking
            const singleBooking = userBookings?.[0]
            if (singleBooking) {
              confirm().then((result) => {
                if (result) {
                  cancelBooking({ id: singleBooking.id });
                }
              });
            } else {
              toast.error('No booking found to cancel');
            }
          }
        }),
    },
    trialable: {
      label: isNavigating ? "Loading..." : "Book Trial Class",
      variant: "default" as const,
      className: getButtonClassName("trialable"),
      disabled: isNavigating,
      action: () =>
        requireAuth(() => {
          setIsNavigating(true);
          // MVP: Always redirect to booking page instead of direct check-in
          router.push(`/bookings/${id}`);
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
