import { describe, it, expect } from "vitest"

import { timeslotsForStaffBookingsExcludingPending } from "@repo/bookings-plugin/src/components/lessons/staff-booking-visibility"

describe("Timeslot Admin booking visibility - staff excludes only pending", () => {
  it("staff can see confirmed/cancelled/waiting but not pending", () => {
    const timeslots = [
      {
        id: 1,
        bookings: {
          docs: [
            { id: "b1", status: "pending" },
            { id: "b2", status: "confirmed" },
            { id: "b3", status: "cancelled" },
            { id: "b4", status: "waiting" },
          ],
        },
      },
    ] as any

    const staffUser = { roles: ["staff"] } as any

    const filtered = timeslotsForStaffBookingsExcludingPending(timeslots, staffUser)
    const statuses = filtered[0].bookings.docs.map((b: any) => b.status)

    expect(statuses).toEqual(["confirmed", "cancelled", "waiting"])
  })

  it("admin sees all statuses (including pending)", () => {
    const timeslots = [
      {
        id: 1,
        bookings: {
          docs: [
            { id: "b1", status: "pending" },
            { id: "b2", status: "confirmed" },
            { id: "b3", status: "cancelled" },
            { id: "b4", status: "waiting" },
          ],
        },
      },
    ] as any

    const adminUser = { roles: ["admin"] } as any

    const filtered = timeslotsForStaffBookingsExcludingPending(timeslots, adminUser)
    const statuses = filtered[0].bookings.docs.map((b: any) => b.status)

    expect(statuses).toEqual(["pending", "confirmed", "cancelled", "waiting"])
  })
})

