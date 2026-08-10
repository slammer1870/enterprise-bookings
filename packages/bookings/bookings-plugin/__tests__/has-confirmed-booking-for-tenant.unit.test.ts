import { describe, it, expect, vi } from "vitest";

import { hasConfirmedBookingForTenant } from "../src/utils/has-confirmed-booking-for-tenant";

describe("hasConfirmedBookingForTenant", () => {
  it("returns false for invalid userId", async () => {
    const payload = { find: vi.fn() };
    expect(
      await hasConfirmedBookingForTenant({
        payload,
        userId: 0,
        tenantId: 1,
      }),
    ).toBe(false);
    expect(payload.find).not.toHaveBeenCalled();
  });

  it("returns false when user has no confirmed bookings", async () => {
    const payload = {
      find: vi
        .fn()
        .mockResolvedValueOnce({ docs: [] })
        .mockResolvedValueOnce({ docs: [] }),
    };
    expect(
      await hasConfirmedBookingForTenant({
        payload,
        userId: 10,
        tenantId: 2,
      }),
    ).toBe(false);
    expect(payload.find).toHaveBeenCalledTimes(2);
  });

  it("returns true when user has a confirmed booking for the same tenant", async () => {
    const payload = {
      find: vi.fn().mockResolvedValueOnce({ docs: [{ id: 1 }] }),
    };
    expect(
      await hasConfirmedBookingForTenant({
        payload,
        userId: 10,
        tenantId: 2,
      }),
    ).toBe(true);
  });

  it("includes tenant filter in the where clause when tenantId is set", async () => {
    const payload = {
      find: vi
        .fn()
        .mockResolvedValueOnce({ docs: [] })
        .mockResolvedValueOnce({ docs: [] }),
    };
    await hasConfirmedBookingForTenant({
      payload,
      userId: 10,
      tenantId: 7,
    });

    const ownCall = payload.find.mock.calls[0]?.[0] as {
      where: { and: Array<Record<string, unknown>> };
    };
    expect(ownCall.where.and).toEqual(
      expect.arrayContaining([
        { user: { equals: 10 } },
        { status: { equals: "confirmed" } },
        { tenant: { equals: 7 } },
      ]),
    );
  });

  it("omits tenant clause when tenantId is null", async () => {
    const payload = {
      find: vi
        .fn()
        .mockResolvedValueOnce({ docs: [] })
        .mockResolvedValueOnce({ docs: [] }),
    };
    await hasConfirmedBookingForTenant({
      payload,
      userId: 10,
      tenantId: null,
    });

    const ownCall = payload.find.mock.calls[0]?.[0] as {
      where: { and: Array<Record<string, unknown>> };
    };
    expect(ownCall.where.and).toEqual([
      { user: { equals: 10 } },
      { status: { equals: "confirmed" } },
    ]);
    expect(
      ownCall.where.and.some((clause) => "tenant" in clause),
    ).toBe(false);
  });

  it("falls back to child bookings via user.parentUser", async () => {
    const payload = {
      find: vi
        .fn()
        .mockResolvedValueOnce({ docs: [] })
        .mockResolvedValueOnce({ docs: [{ id: 99 }] }),
    };
    expect(
      await hasConfirmedBookingForTenant({
        payload,
        userId: 42,
        tenantId: 3,
      }),
    ).toBe(true);

    const childCall = payload.find.mock.calls[1]?.[0] as {
      where: { and: Array<Record<string, unknown>> };
    };
    expect(childCall.where.and).toEqual(
      expect.arrayContaining([
        { "user.parentUser": { equals: 42 } },
        { status: { equals: "confirmed" } },
        { tenant: { equals: 3 } },
      ]),
    );
  });

  it("returns own-user result when nested parentUser query fails", async () => {
    const payload = {
      find: vi
        .fn()
        .mockResolvedValueOnce({ docs: [] })
        .mockRejectedValueOnce(new Error("nested unsupported")),
    };
    expect(
      await hasConfirmedBookingForTenant({
        payload,
        userId: 10,
        tenantId: 2,
      }),
    ).toBe(false);
  });

  it("uses custom bookingsSlug", async () => {
    const payload = {
      find: vi.fn().mockResolvedValueOnce({ docs: [{ id: 1 }] }),
    };
    await hasConfirmedBookingForTenant({
      payload,
      userId: 10,
      tenantId: 2,
      bookingsSlug: "custom-bookings",
    });
    expect(payload.find.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ collection: "custom-bookings" }),
    );
  });

  it("coerces string Better Auth user/tenant ids", async () => {
    const payload = {
      find: vi.fn().mockResolvedValueOnce({ docs: [{ id: 1 }] }),
    };
    expect(
      await hasConfirmedBookingForTenant({
        payload,
        userId: "10",
        tenantId: "7",
      }),
    ).toBe(true);

    const ownCall = payload.find.mock.calls[0]?.[0] as {
      where: { and: Array<Record<string, unknown>> };
    };
    expect(ownCall.where.and).toEqual(
      expect.arrayContaining([
        { user: { equals: 10 } },
        { status: { equals: "confirmed" } },
        { tenant: { equals: 7 } },
      ]),
    );
  });
});
