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

  it("returns false when the user has no bookings", async () => {
    const payload = {
      find: vi.fn().mockResolvedValueOnce({ docs: [] }),
    };
    expect(
      await hasUsedDropInProduct({ payload, userId: 10, dropInId: 3 }),
    ).toBe(false);
    expect(payload.find).toHaveBeenCalledTimes(1);
  });

  it("returns false when bookings exist but no matching stripe drop-in txn", async () => {
    const payload = {
      find: vi
        .fn()
        .mockResolvedValueOnce({ docs: [{ id: 100 }, { id: 101 }] })
        .mockResolvedValueOnce({ docs: [] }),
    };
    expect(
      await hasUsedDropInProduct({ payload, userId: 10, dropInId: 3 }),
    ).toBe(false);
  });

  it("returns true when a stripe transaction matches the drop-in id", async () => {
    const payload = {
      find: vi
        .fn()
        .mockResolvedValueOnce({ docs: [{ id: 100 }] })
        .mockResolvedValueOnce({ docs: [{ id: 1 }] }),
    };
    expect(
      await hasUsedDropInProduct({ payload, userId: 10, dropInId: 3 }),
    ).toBe(true);

    const txnCall = payload.find.mock.calls[1]?.[0] as {
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

  it("queries bookings for user or parentUser children", async () => {
    const payload = {
      find: vi.fn().mockResolvedValueOnce({ docs: [] }),
    };
    await hasUsedDropInProduct({ payload, userId: 42, dropInId: 7 });
    const bookingCall = payload.find.mock.calls[0]?.[0] as {
      where: { or: Array<Record<string, unknown>> };
    };
    expect(bookingCall.where.or).toEqual([
      { user: { equals: 42 } },
      { "user.parentUser": { equals: 42 } },
    ]);
  });
});
