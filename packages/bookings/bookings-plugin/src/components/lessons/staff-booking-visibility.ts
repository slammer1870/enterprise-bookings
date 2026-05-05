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

  // In the admin list view, `getTimeslots()` populates `bookings` with `docs: []`
  // and only uses `totalDocs` for counts. In that case, filtering `docs` is
  // redundant, but the `.map()` still allocates new timeslot objects.
  const hasAnyBookingDocs = timeslots.some((ts) => (ts.bookings?.docs ?? []).length > 0)
  if (!hasAnyBookingDocs) return timeslots

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

