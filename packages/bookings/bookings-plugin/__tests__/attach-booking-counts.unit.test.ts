/**
 * Regression: admin timeslot list booking counts must not read as 0 when bookings exist.
 *
 * attachBookingCountsForTimeslots uses `limit: 0` to fetch all booking rows in one query.
 * Payload 3.x treats `limit: 0` as "return no rows" unless `pagination: false` is set,
 * which made the admin UI show 0 for every timeslot.
 */
import { describe, expect, it, vi } from "vitest";
import type { BasePayload } from "payload";

import { getTimeslots } from "../src/data/timeslots";

const TIMESLOT_A = 101;
const TIMESLOT_B = 102;

function createMockPayload(find: ReturnType<typeof vi.fn>): BasePayload {
  return {
    config: {
      collections: [
        {
          slug: "timeslots",
          fields: [
            { type: "relationship", name: "tenant", relationTo: "tenants" },
            { type: "relationship", name: "eventType", relationTo: "event-types" },
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
    find,
  } as unknown as BasePayload;
}

function bookingRowsForCountsQuery(args: {
  collection: string;
  limit?: number;
  pagination?: boolean;
}) {
  if (args.collection !== "bookings" || args.limit !== 0) {
    return null;
  }

  // Mirror Payload 3.x: limit 0 without pagination: false returns no rows.
  if (args.pagination !== false) {
    return { docs: [], totalDocs: 0 };
  }

  return {
    docs: [
      { timeslot: TIMESLOT_A },
      { timeslot: TIMESLOT_A },
      { timeslot: TIMESLOT_B },
    ],
    totalDocs: 3,
  };
}

describe("getTimeslots — attachBookingCountsForTimeslots", () => {
  it("requests all booking rows with pagination: false and attaches per-timeslot totals", async () => {
    const listTimeslots = [
      {
        id: TIMESLOT_A,
        startTime: "2026-06-16T09:00:00.000Z",
        endTime: "2026-06-16T10:00:00.000Z",
        tenant: 1,
        eventType: 1,
      },
      {
        id: TIMESLOT_B,
        startTime: "2026-06-16T11:00:00.000Z",
        endTime: "2026-06-16T12:00:00.000Z",
        tenant: 1,
        eventType: 1,
      },
    ];

    const find = vi.fn().mockImplementation((args: {
      collection: string;
      limit?: number;
      pagination?: boolean;
      where?: { id?: { in?: number[] } };
    }) => {
      if (args.collection === "timeslots") {
        return Promise.resolve({ docs: listTimeslots, totalDocs: 2, hasNextPage: false });
      }

      const bookingRows = bookingRowsForCountsQuery(args);
      if (bookingRows) {
        return Promise.resolve(bookingRows);
      }

      if (args.collection === "tenants" || args.collection === "event-types") {
        const id = args.where?.id?.in?.[0] ?? 1;
        return Promise.resolve({
          docs: [{ id, slug: "test", name: "Test class", timeZone: "Europe/Dublin" }],
          totalDocs: 1,
        });
      }

      return Promise.resolve({ docs: [], totalDocs: 0 });
    });

    const payload = createMockPayload(find);
    const startOfDay = new Date("2026-06-16T00:00:00.000Z");

    const timeslots = await getTimeslots(
      payload,
      {
        "where[or][0][and][0][startTime][greater_than_equal]": startOfDay.toISOString(),
      },
      { segments: ["admin", "collections", "timeslots"] },
    );

    const bookingsFindCall = find.mock.calls.find(([args]) => args.collection === "bookings");
    expect(bookingsFindCall).toBeDefined();
    expect(bookingsFindCall![0]).toMatchObject({
      limit: 0,
      pagination: false,
      overrideAccess: true,
    });

    const byId = Object.fromEntries(timeslots.map((t) => [t.id, t]));
    expect((byId[TIMESLOT_A]?.bookings as { totalDocs?: number })?.totalDocs).toBe(2);
    expect((byId[TIMESLOT_B]?.bookings as { totalDocs?: number })?.totalDocs).toBe(1);
  });
});
