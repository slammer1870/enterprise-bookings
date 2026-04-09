import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/timeslot", () => ({
  validateTimeslotStatus: vi.fn(() => true),
  validateTimeslotPaymentMethods: vi.fn(async () => true),
}));

import { bookingUpdateMembershipDropinAccess } from "../src/access/booking-membership-dropin";

type MockPayload = {
  findByID: ReturnType<typeof vi.fn>;
  find: ReturnType<typeof vi.fn>;
};

function createPayloadMocks(): MockPayload {
  return {
    findByID: vi.fn(),
    find: vi.fn(),
  };
}

describe("bookingUpdateMembershipDropinAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows owners to cancel when auth id is a string", async () => {
    const payload = createPayloadMocks();
    payload.findByID
      .mockResolvedValueOnce({
        id: 123,
        user: { id: 42 },
        timeslot: { id: 88 },
      })
      .mockResolvedValueOnce({
        id: 88,
        bookingStatus: "open",
      })
      .mockResolvedValueOnce({
        id: 42,
        roles: ["user"],
      });

    const allowed = await bookingUpdateMembershipDropinAccess({
      id: 123,
      req: {
        user: { id: "42", roles: ["user"] },
        data: { status: "cancelled" },
        payload,
        searchParams: new URLSearchParams(),
      },
    } as any);

    expect(allowed).toBe(true);
    expect(payload.findByID).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        collection: "bookings",
        id: 123,
        overrideAccess: true,
      })
    );
    expect(payload.findByID).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        collection: "timeslots",
        id: 88,
        overrideAccess: true,
      })
    );
    expect(payload.findByID).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        collection: "users",
        id: "42",
        overrideAccess: true,
      })
    );
  });

  it("rejects cancellation when requester does not own the booking", async () => {
    const payload = createPayloadMocks();
    payload.findByID
      .mockResolvedValueOnce({
        id: 123,
        user: { id: 77 },
        timeslot: { id: 88 },
      })
      .mockResolvedValueOnce({
        id: 88,
        bookingStatus: "open",
      })
      .mockResolvedValueOnce({
        id: 77,
        roles: ["user"],
      });

    const allowed = await bookingUpdateMembershipDropinAccess({
      id: 123,
      req: {
        user: { id: "42", roles: ["user"] },
        data: { status: "cancelled" },
        payload,
        searchParams: new URLSearchParams(),
      },
    } as any);

    expect(allowed).toBe(false);
  });
});
