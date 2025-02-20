"use client";

import { useRouter } from "next/navigation";

import { toast } from "sonner";

import { Button } from "@repo/ui/components/ui/button";

import { useConfirm } from "@repo/ui/components/ui/use-confirm";

import { Lesson } from "../../../types";

import { getActiveBookingsQuery } from "@repo/shared-utils";

import { useSchedule } from "../../../providers/schedule";

import { useState } from "react";

export default function CheckInButton({ lesson }: { lesson: Lesson }) {
  const router = useRouter();

  const [loading, setLoading] = useState(false);

  const { checkIn, cancelBooking } = useSchedule();

  const status = lesson.bookingStatus;

  const [ConfirmationDialog, confirm] = useConfirm(
    "Are you sure you want to cancel your booking?",
    "This action cannot be undone"
  );

  const handleClick = async () => {
    const data = await fetch("/api/users/me", {
      credentials: "include",
    });

    const { user } = await data.json();

    if (!user) {
      toast.info("Please sign in to continue");
      router.push(`register?callbackUrl=/bookings/${lesson.id}`, {
        scroll: false,
      });
      return;
    }

    if (lesson.classOption.type === "child") {
      router.push(`/bookings/children/${lesson.id}`);
    }

    try {
      switch (status) {
        case "active":
        case "trialable":
          // Perform check-in logic here
          setLoading(true);
          checkIn(lesson.id, user.id);
          setLoading(false);

          break;
        case "closed":
          toast.error("Class is closed for check-in");
          break;
        case "waitlist":
          toast.info("You are on the waitlist");
          break;

        case "booked":
          const ok = await confirm();
          if (ok) {
            setLoading(true);
            cancelBooking(lesson.id, user.id);
            setLoading(false);
          }
          break;
        default:
          toast.error("Unknown status");
      }
    } catch (error) {
      console.error("Error checking in:", error);
      toast.error("Failed to check in");
    }
  };

  const buttonStyles = {
    closed: "bg-muted text-muted-foreground ",
    waitlist: "bg-accent",
    trialable: "bg-secondary",
    active: "bg-primary",
    booked: "bg-destructive",
  };

  return (
    <>
      <Button
        onClick={handleClick}
        className={`w-full p-2 border-none ${buttonStyles[status as keyof typeof buttonStyles]}`}
      >
        {loading
          ? "Loading..."
          : status === "closed"
            ? "Closed"
            : status === "waitlist"
              ? "Join the waitlist"
              : status === "trialable"
                ? "Book Trial Class"
                : status === "active"
                  ? lesson.classOption.type === "child"
                    ? "Check Child In"
                    : "Check In"
                  : "Cancel Booking"}
      </Button>
      <ConfirmationDialog />
    </>
  );
}
