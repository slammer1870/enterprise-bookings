import { useState, useCallback } from "react";
import { Attendee, User } from "@repo/shared-types";

interface UseAttendeesOptions {
  user: User;
  maxCapacity: number;
  currentAttendees: number;
}

export function useAttendees({
  user,
  maxCapacity,
  currentAttendees,
}: UseAttendeesOptions) {
  const remainingCapacity = maxCapacity - currentAttendees;

  // Initialize with one attendee (the primary booker)
  const [attendees, setAttendees] = useState<Attendee[]>([
    { id: "primary-user", name: user.name || "", email: user.email || "" },
  ]);

  // Validate email format
  const isValidEmail = useCallback((email: string): boolean => {
    if (!email) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }, []);

  // Check for duplicate emails
  const isDuplicateEmail = useCallback(
    (email: string, currentId: string): boolean => {
      if (!email) return false; // Empty emails don't count as duplicates
      return attendees.some(
        (attendee) =>
          attendee.id !== currentId &&
          attendee.email.toLowerCase() === email.toLowerCase()
      );
    },
    [attendees]
  );

  // Check if form is valid (no duplicate emails)
  const hasValidForm = useCallback((): boolean => {
    // Check for empty required fields
    const hasEmptyFields = attendees.some((a) => !a.name || !a.email);

    // Check for duplicate emails
    const hasDuplicateEmails = attendees.some((a) =>
      isDuplicateEmail(a.email, a.id)
    );

    // Check for invalid email formats
    const hasInvalidEmails = attendees.some((a) => !isValidEmail(a.email));

    return !hasEmptyFields && !hasDuplicateEmails && !hasInvalidEmails;
  }, [attendees, isDuplicateEmail, isValidEmail]);

  return {
    attendees,
    setAttendees,
    remainingCapacity,
    hasValidForm,
    isDuplicateEmail,
    isValidEmail,
  };
}
