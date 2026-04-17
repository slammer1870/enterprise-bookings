import { checkRole } from "@repo/shared-utils"
import type { Booking, Timeslot, User as SharedUser } from "@repo/shared-types"

/**
 * Staff-only users see everything except `pending` bookings.
 * Org admins + platform super-admins see all booking statuses.
 */
export function timeslotsForStaffBookingsExcludingPending(
  timeslots: Timeslot[],
  user: unknown | undefined,
): Timeslot[] {
  const u = user as SharedUser | null | undefined

  if (
    !u ||
    !checkRole(["staff"], u) ||
    checkRole(["admin"], u) ||
    checkRole(["super-admin"], u)
  ) {
    return timeslots
  }

  return timeslots.map((ts) => {
    const docs = (ts.bookings?.docs ?? []) as Booking[]

    return {
      ...ts,
      bookings: {
        ...ts.bookings,
        docs: docs.filter((b) => b.status !== "pending"),
      },
    }
  })
}

