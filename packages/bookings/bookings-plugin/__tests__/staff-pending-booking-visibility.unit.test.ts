import { describe, expect, it } from "vitest";

import {
  pendingBookingsExcludedWhere,
  staffOnlyTenantIdsFromUser,
} from "../src/utils/timeslot-booking-queries";

describe("staffOnlyTenantIdsFromUser", () => {
  it("returns only tenants where the user is staff and not an org admin", () => {
    expect(
      staffOnlyTenantIdsFromUser({
        id: 1,
        role: ["admin"],
        tenants: [
          { tenant: 7, roles: ["staff"] },
          { tenant: 9, roles: ["admin"] },
          { tenant: 11, roles: ["admin", "staff"] },
          { tenant: 13, roles: ["location-manager"] },
        ],
      }),
    ).toEqual([7]);
  });

  it("returns no tenants for a super-admin", () => {
    expect(
      staffOnlyTenantIdsFromUser({
        id: 1,
        role: ["super-admin"],
        tenants: [{ tenant: 7, roles: ["staff"] }],
      }),
    ).toEqual([]);
  });
});

describe("pendingBookingsExcludedWhere", () => {
  it("hides pending bookings only on staff tenants", () => {
    expect(
      pendingBookingsExcludedWhere({
        id: 1,
        role: ["admin"],
        tenants: [
          { tenant: 7, roles: ["staff"] },
          { tenant: 9, roles: ["admin"] },
        ],
      }),
    ).toEqual({
      or: [
        {
          and: [
            { tenant: { in: [7] } },
            { status: { not_equals: "pending" } },
          ],
        },
        { tenant: { not_in: [7] } },
      ],
    });
  });

  it("hides every pending booking when a staff role has no membership rows yet", () => {
    expect(
      pendingBookingsExcludedWhere({
        id: 1,
        role: ["staff"],
      }),
    ).toEqual({ status: { not_equals: "pending" } });
  });

  it("leaves pending bookings visible for an org admin of that tenant", () => {
    expect(
      pendingBookingsExcludedWhere({
        id: 1,
        role: ["admin"],
        tenants: [{ tenant: 9, roles: ["admin", "staff"] }],
      }),
    ).toBeNull();
  });
});
