import { describe, it, expect, vi } from "vitest";
import { hasUsedDropInProduct } from "../src/drop-ins/hasUsedDropInProduct";

describe("hasUsedDropInProduct", () => {
  it("returns false for invalid ids", async () => {
    const payload = { find: vi.fn() };
    expect(
      await hasUsedDropInProduct({ payload, userId: 0, dropInId: 1 }),
    ).toBe(false);
    expect(
      await hasUsedDropInProduct({ payload, userId: 1, dropInId: -1 }),
    ).toBe(false);
    expect(payload.find).not.toHaveBeenCalled();
  });

  it("returns false when nested txn query finds nothing", async () => {
    const payload = {
      find: vi.fn().mockResolvedValueOnce({ docs: [] }),
    };
    expect(
      await hasUsedDropInProduct({ payload, userId: 10, dropInId: 3 }),
    ).toBe(false);
    expect(payload.find).toHaveBeenCalledTimes(1);
    const txnCall = payload.find.mock.calls[0]?.[0] as {
      collection: string;
      where: { and: Array<Record<string, unknown>> };
    };
    expect(txnCall.collection).toBe("transactions");
    expect(txnCall.where.and).toEqual(
      expect.arrayContaining([
        { paymentMethod: { equals: "stripe" } },
        { dropInId: { equals: 3 } },
      ]),
    );
  });

  it("returns true when nested txn query matches", async () => {
    const payload = {
      find: vi.fn().mockResolvedValueOnce({ docs: [{ id: 1 }] }),
    };
    expect(
      await hasUsedDropInProduct({ payload, userId: 10, dropInId: 3 }),
    ).toBe(true);
  });

  it("queries nested booking.user for family accounts", async () => {
    const payload = {
      find: vi.fn().mockResolvedValueOnce({ docs: [] }),
    };
    await hasUsedDropInProduct({ payload, userId: 42, dropInId: 7 });
    const txnCall = payload.find.mock.calls[0]?.[0] as {
      where: { and: Array<Record<string, unknown>> };
    };
    const userOr = txnCall.where.and.find(
      (clause) => clause.or != null,
    ) as { or: Array<Record<string, unknown>> };
    expect(userOr.or).toEqual([
      { "booking.user": { equals: 42 } },
      { "booking.user.parentUser": { equals: 42 } },
    ]);
  });

  it("falls back to booking-id preload when nested txn query fails", async () => {
    const payload = {
      find: vi
        .fn()
        // nested family txn
        .mockRejectedValueOnce(new Error("nested unsupported"))
        // nested user-only txn
        .mockRejectedValueOnce(new Error("nested unsupported"))
        // bookings preload
        .mockResolvedValueOnce({ docs: [{ id: 100 }] })
        // txn by booking ids
        .mockResolvedValueOnce({ docs: [{ id: 1 }] }),
    };
    expect(
      await hasUsedDropInProduct({ payload, userId: 10, dropInId: 3 }),
    ).toBe(true);

    const bookingCall = payload.find.mock.calls[2]?.[0] as {
      collection: string;
      sort?: string;
      limit?: number;
    };
    expect(bookingCall.collection).toBe("bookings");
    expect(bookingCall.sort).toBe("-id");
    expect(bookingCall.limit).toBe(500);

    const txnCall = payload.find.mock.calls[3]?.[0] as {
      where: { and: Array<Record<string, unknown>> };
    };
    expect(txnCall.where.and).toEqual(
      expect.arrayContaining([
        { booking: { in: [100] } },
        { paymentMethod: { equals: "stripe" } },
        { dropInId: { equals: 3 } },
      ]),
    );
  });
});
