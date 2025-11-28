import { Lesson } from "@repo/shared-types";
import { BookingSummary } from "./booking-summary";

/**
 * Result type from validateAndAttemptCheckIn tRPC procedure
 */
export type ValidateCheckInResult = {
  shouldRedirect: boolean;
  error: string | null;
  reason: string | null;
  redirectUrl?: string;
};

/**
 * Component for validating and displaying booking information.
 * 
 * This component combines booking validation with the booking summary display.
 * Check-in validation should be handled at the PAGE LEVEL using the
 * `bookings.validateAndAttemptCheckIn` tRPC procedure before this component is rendered.
 * 
 * Example usage in a page component:
 * ```tsx
 * const caller = await createCaller()
 * const checkInResult = await caller.bookings.validateAndAttemptCheckIn({ lessonId: id });
 * if (checkInResult.shouldRedirect) {
 *   redirect('/dashboard');
 * }
 * // Then render this component
 * <ValidateBooking lesson={lesson} user={user} validationResult={checkInResult} />
 * ```
 */
export const ValidateBooking = async ({
  lesson,
  user,
  validationResult,
}: {
  lesson: Lesson;
  user: { id: string | number; name?: string | null; email?: string | null };
  validationResult?: ValidateCheckInResult;
}) => {
  return (
    <div className="space-y-4">
      <BookingSummary lesson={lesson} />
      
      {validationResult && (
        <div className="space-y-2">
          {validationResult.error && validationResult.error !== 'REDIRECT_TO_CHILDREN_BOOKING' && (
            <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">
              <p className="font-medium">Validation Error</p>
              <p>{validationResult.error}</p>
            </div>
          )}
          
          {validationResult.reason && !validationResult.shouldRedirect && (
            <div className="rounded-md bg-blue-50 p-4 text-sm text-blue-800">
              <p className="font-medium">Status</p>
              <p>{validationResult.reason}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
