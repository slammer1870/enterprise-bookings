/**
 * Regression: admin timeslot list booking counts must not read as 0 when bookings exist.
 *
 * attachBookingCountsForTimeslots uses per-timeslot payload.count() so counts match the
 * join field used when expanding a row, including legacy migrated bookings.
 */
import { describe, expect, it, vi } from "vitest";
import type { BasePayload } from "payload";

import { getTimeslots } from "../src/data/timeslots";

const TIMESLOT_A = 101;
const TIMESLOT_B = 102;

function createMockPayload(args: {
  find: ReturnType<typeof vi.fn>;
  count: ReturnType<typeof vi.fn>;
}): BasePayload {
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
    find: args.find,
    count: args.count,
  } as unknown as BasePayload;
}

describe("getTimeslots — attachBookingCountsForTimeslots", () => {
  it("counts bookings per timeslot with overrideAccess and attaches totals", async () => {
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
      where?: { id?: { in?: number[] } };
    }) => {
      if (args.collection === "timeslots") {
        return Promise.resolve({ docs: listTimeslots, totalDocs: 2, hasNextPage: false });
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

    const count = vi.fn().mockImplementation((args: {
      collection: string;
      where?: { and?: Array<{ timeslot?: { equals?: number } }> };
    }) => {
      if (args.collection !== "bookings") {
        return Promise.resolve({ totalDocs: 0 });
      }

      const timeslotId = args.where?.and?.[0]?.timeslot?.equals;
      if (timeslotId === TIMESLOT_A) return Promise.resolve({ totalDocs: 2 });
      if (timeslotId === TIMESLOT_B) return Promise.resolve({ totalDocs: 1 });
      return Promise.resolve({ totalDocs: 0 });
    });

    const payload = createMockPayload({ find, count });
    const startOfDay = new Date("2026-06-16T00:00:00.000Z");

    const timeslots = await getTimeslots(
      payload,
      {
        "where[or][0][and][0][startTime][greater_than_equal]": startOfDay.toISOString(),
      },
      { segments: ["admin", "collections", "timeslots"] },
    );

    expect(count).toHaveBeenCalledTimes(2);
    expect(count.mock.calls[0]?.[0]).toMatchObject({
      collection: "bookings",
      overrideAccess: true,
    });

    const byId = Object.fromEntries(timeslots.map((t) => [t.id, t]));
    expect((byId[TIMESLOT_A]?.bookings as { totalDocs?: number })?.totalDocs).toBe(2);
    expect((byId[TIMESLOT_B]?.bookings as { totalDocs?: number })?.totalDocs).toBe(1);
  });
});
