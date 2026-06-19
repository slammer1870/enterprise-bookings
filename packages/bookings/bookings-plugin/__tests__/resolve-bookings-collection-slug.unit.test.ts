import { describe, expect, it } from "vitest";
import type { BasePayload } from "payload";

import { resolveBookingsCollectionSlug } from "../src/utils/timeslot-booking-queries";

describe("resolveBookingsCollectionSlug", () => {
  it("uses the timeslots join field, not other collections with a timeslot relationship", () => {
    const payload = {
      config: {
        collections: [
          {
            slug: "booking-checkout-holds",
            fields: [
              { type: "relationship", name: "timeslot", relationTo: "timeslots" },
            ],
          },
          {
            slug: "timeslots",
            fields: [
              { type: "join", name: "bookings", collection: "bookings" },
            ],
          },
          {
            slug: "bookings",
            fields: [
              { type: "relationship", name: "timeslot", relationTo: "timeslots" },
            ],
          },
        ],
      },
    } as unknown as BasePayload;

    expect(resolveBookingsCollectionSlug(payload, "timeslots")).toBe("bookings");
  });
});
