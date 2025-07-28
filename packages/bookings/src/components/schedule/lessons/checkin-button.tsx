"use client";

import { useRouter } from "next/navigation";

import { toast } from "sonner";

import { Button } from "@repo/ui/components/ui/button";

import { useConfirm } from "@repo/ui/components/ui/use-confirm";

import { Lesson } from "@repo/shared-types";

import { useSchedule } from "../../../providers/schedule";

import { useState } from "react";

type ButtonVariant =
  | "ghost"
  | "outline"
  | "secondary"
  | "destructive"
  | "default"
  | "link"
  | null
  | undefined;

export default function CheckInButton({ lesson }: { lesson: Lesson }) {
  const router = useRouter();

  const [loading, setLoading] = useState(false);

  const { checkIn, cancelBooking, joinWaitlist } = useSchedule();

  const status = lesson.bookingStatus;

  const [ConfirmationDialog, confirm] = useConfirm(
    "Are you sure you want to cancel your booking?",
    "Bookings can be cancelled up to 24 hours before the session begins."
  );

  const handleClick = async () => {
    if (loading) return;

    setLoading(true);

    const data = await fetch("/api/users/me", {
      credentials: "include",
    });

    const { user } = await data.json();

    if (!user) {
      toast.info("Please sign in to continue");
      setLoading(false);
      return router.push(`register?callbackUrl=/bookings/${lesson.id}`, {
        scroll: false,
      });
    }

    if (lesson.classOption.type === "child") {
      console.log("pushing to children");
      return router.push(`/bookings/children/${lesson.id}`);
    }

    try {
      switch (status) {
        case "active":
        case "trialable":
          // Perform check-in logic here

          await checkIn(lesson.id, user.id);
          setLoading(false);

          break;
        case "closed":
          toast.error("Class is closed for check-in");
          setLoading(false);
          break;
        case "waitlist":
          await joinWaitlist(lesson.id, user.id);
          setLoading(false);
          break;

        case "booked":
          const ok = await confirm();
          if (ok) {
            setLoading(true);
            await cancelBooking(lesson.id, user.id);
          }
          setLoading(false);
          break;
        case "waiting":
          const ok2 = await confirm();
          if (ok2) {
            setLoading(true);
            await cancelBooking(lesson.id, user.id);
          }
          setLoading(false);
          break;
        default:
          toast.error("Unknown status");
          setLoading(false);
      }
    } catch (error) {
      console.error("Error checking in:", error);
      toast.error("Failed to check in");
      setLoading(false);
    }
  };

  const buttonStyles = {
    closed: "bg-muted text-muted-foreground ",
    waitlist: "bg-accent",
    trialable: "bg-secondary",
    active: "bg-primary",
    booked: "bg-destructive",
    childrenBooked: "bg-outline",
  };

  const buttonVariant: Record<Lesson["bookingStatus"], ButtonVariant> = {
    closed: "ghost",
    waitlist: "outline",
    trialable: "secondary",
    active: "default",
    booked: "destructive",
    waiting: "destructive",
    childrenBooked: "outline",
  };

  return (
    <>
      <Button
        onClick={handleClick}
        variant={buttonVariant[status as keyof typeof buttonVariant]}
        //className={`w-full p-2 border-none ${buttonStyles[status as keyof typeof buttonStyles]}`}
        className="w-full"
        disabled={loading || status === "closed"}
      >
        {loading
          ? "Loading..."
          : status === "closed"
            ? "Closed"
            : status === "waitlist"
              ? "Join the Waitlist"
              : status === "trialable"
                ? "Book Trial Class"
                : status === "waiting"
                  ? "Leave the Waitlist"
                  : status === "active"
                    ? lesson.classOption.type === "child"
                      ? "Check Child In"
                      : "Check In"
                    : status === "childrenBooked"
                      ? "Manage Children"
                      : "Cancel Booking"}
      </Button>
      <ConfirmationDialog />
    </>
  );
}
