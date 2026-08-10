import { describe, it, expect, vi } from "vitest";

import { createGetBookingStatus } from "../src/hooks/booking-status";
import { DEFAULT_BOOKING_COLLECTION_SLUGS } from "../src/resolve-slugs";

const trialEventType = {
  id: 50,
  places: 10,
  type: "adult",
  paymentMethods: {
    allowedDropIn: {
      discountTiers: [{ minQuantity: 1, discountPercent: 50, type: "trial" }],
    },
  },
};

function futureStartTime(): string {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

describe("createGetBookingStatus — tenant-scoped trialable", () => {
  it("stays trialable when user only has confirmed bookings on another tenant", async () => {
    const find = vi
      .fn()
      // confirmed capacity for timeslot
      .mockResolvedValueOnce({ docs: [], totalDocs: 0 })
      // user confirmed on this timeslot
      .mockResolvedValueOnce({ docs: [] })
      // hasConfirmedBookingForTenant — own
      .mockResolvedValueOnce({ docs: [] })
      // hasConfirmedBookingForTenant — child
      .mockResolvedValueOnce({ docs: [] });

    const findByID = vi.fn().mockResolvedValue(trialEventType);
    const hook = createGetBookingStatus(DEFAULT_BOOKING_COLLECTION_SLUGS);

    const status = await hook({
      req: {
        user: { id: 10 },
        payload: { find, findByID },
      },
      data: {
        id: 100,
        eventType: 50,
        tenant: 2,
        startTime: futureStartTime(),
        lockOutTime: 0,
      },
      context: {},
    } as any);

    expect(status).toBe("trialable");

    const trialOwnCall = find.mock.calls[2]?.[0] as {
      where: { and: Array<Record<string, unknown>> };
    };
    expect(trialOwnCall.where.and).toEqual(
      expect.arrayContaining([
        { user: { equals: 10 } },
        { status: { equals: "confirmed" } },
        { tenant: { equals: 2 } },
      ]),
    );
  });

  it("returns active when user has a confirmed booking on the same tenant", async () => {
    const find = vi
      .fn()
      .mockResolvedValueOnce({ docs: [], totalDocs: 0 })
      .mockResolvedValueOnce({ docs: [] })
      // hasConfirmedBookingForTenant — own on same tenant
      .mockResolvedValueOnce({ docs: [{ id: 1 }] });

    const findByID = vi.fn().mockResolvedValue(trialEventType);
    const hook = createGetBookingStatus(DEFAULT_BOOKING_COLLECTION_SLUGS);

    const status = await hook({
      req: {
        user: { id: 10 },
        payload: { find, findByID },
      },
      data: {
        id: 100,
        eventType: 50,
        tenant: 2,
        startTime: futureStartTime(),
        lockOutTime: 0,
      },
      context: {},
    } as any);

    expect(status).toBe("active");
  });

  it("returns active when Better Auth supplies a string user id", async () => {
    const find = vi
      .fn()
      .mockResolvedValueOnce({ docs: [], totalDocs: 0 })
      .mockResolvedValueOnce({ docs: [] })
      .mockResolvedValueOnce({ docs: [{ id: 1 }] });

    const findByID = vi.fn().mockResolvedValue(trialEventType);
    const hook = createGetBookingStatus(DEFAULT_BOOKING_COLLECTION_SLUGS);

    const status = await hook({
      req: {
        user: { id: "10" },
        payload: { find, findByID },
      },
      data: {
        id: 100,
        eventType: 50,
        tenant: "2",
        startTime: futureStartTime(),
        lockOutTime: 0,
      },
      context: {},
    } as any);

    expect(status).toBe("active");
    const trialOwnCall = find.mock.calls[2]?.[0] as {
      where: { and: Array<Record<string, unknown>> };
    };
    expect(trialOwnCall.where.and).toEqual(
      expect.arrayContaining([
        { user: { equals: 10 } },
        { tenant: { equals: 2 } },
      ]),
    );
  });
});
