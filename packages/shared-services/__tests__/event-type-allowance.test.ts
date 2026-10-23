import { describe, expect, it } from "vitest";
import {
  adjustClassPassCredits,
  allowedEventTypeIdsIncludingOverrides,
  creditsRemainingForEventType,
  displayQuantityForClassPassType,
  maxBookingsPerTimeslotOverride,
  snapshotClassPassCredits,
  validateEventTypeOverrideRows,
} from "../src/event-type-allowance";

const sauna = 2;
const float = 3;

describe("snapshotClassPassCredits", () => {
  it("copies the shared quantity and the override rows", () => {
    const snapshot = snapshotClassPassCredits({
      quantity: 5,
      allowedEventTypes: [sauna, float],
      eventTypeOverrides: [{ eventType: float, quantity: 1 }],
    });

    expect(snapshot.quantity).toBe(5);
    expect(snapshot.eventTypeOverrides).toEqual([{ eventTypes: [float], quantity: 1 }]);
  });

  it("stores shared quantity 0 when every allowed event type has an override", () => {
    const type = {
      quantity: 9,
      allowedEventTypes: [sauna, float],
      eventTypeOverrides: [
        { eventType: sauna, quantity: 2 },
        { eventType: float, quantity: 3 },
      ],
    };

    expect(snapshotClassPassCredits(type)).toEqual({
      quantity: 0,
      eventTypeOverrides: [
        { eventTypes: [sauna], quantity: 2 },
        { eventTypes: [float], quantity: 3 },
      ],
    });
    expect(displayQuantityForClassPassType(type, 9)).toBe(5);
  });

  it("stores one quantity of 2 for yoga beginners and fundamentals and shows 2", () => {
    const beginners = 11;
    const fundamentals = 12;
    const type = {
      quantity: 9,
      allowedEventTypes: [beginners, fundamentals],
      eventTypeOverrides: [{ eventTypes: [beginners, fundamentals], quantity: 2 }],
    };

    const snapshot = snapshotClassPassCredits(type);
    expect(snapshot).toEqual({
      quantity: 0,
      eventTypeOverrides: [{ eventTypes: [beginners, fundamentals], quantity: 2 }],
    });
    expect(displayQuantityForClassPassType(type, 9)).toBe(2);
    expect(creditsRemainingForEventType(snapshot, beginners)).toBe(2);
    expect(creditsRemainingForEventType(snapshot, fundamentals)).toBe(2);
  });
});

describe("maxBookingsPerTimeslotOverride", () => {
  it("returns the row cap for that event type and leaves other types to the product cap", () => {
    const rows = [
      { eventType: float, quantity: 4, maxBookingsPerTimeslot: 2 },
      { eventType: sauna, quantity: 1 },
    ];

    expect(maxBookingsPerTimeslotOverride(rows, float)).toBe(2);
    expect(maxBookingsPerTimeslotOverride(rows, sauna)).toBeUndefined();
    expect(maxBookingsPerTimeslotOverride(rows, 99)).toBeUndefined();
  });
});

describe("adjustClassPassCredits", () => {
  const pass = {
    quantity: 2,
    status: "active" as const,
    eventTypeOverrides: [
      { eventType: sauna, quantity: 1 },
      { eventType: float, quantity: 1 },
    ],
  };

  it("spends the float row without reducing the sauna row, rejects a second float, and restores the float row", () => {
    const spent = adjustClassPassCredits(pass, float, -1);
    expect(spent.ok).toBe(true);
    if (!spent.ok) return;

    expect(spent.pass.quantity).toBe(2);
    expect(spent.pass.eventTypeOverrides).toEqual([
      { eventTypes: [sauna], quantity: 1 },
      { eventTypes: [float], quantity: 0 },
    ]);
    expect(spent.pass.status).toBe("active");

    const second = adjustClassPassCredits(spent.pass, float, -1);
    expect(second.ok).toBe(false);

    const restored = adjustClassPassCredits(spent.pass, float, 1);
    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    expect(restored.pass.eventTypeOverrides.find((row) => row.eventTypes.includes(float))?.quantity).toBe(1);
    expect(restored.pass.eventTypeOverrides.find((row) => row.eventTypes.includes(sauna))?.quantity).toBe(1);
    expect(restored.pass.status).toBe("active");
  });

  it("lets yoga and sauna draw one shared quantity and leaves the float row alone", () => {
    const start = {
      quantity: 2,
      status: "active" as const,
      eventTypeOverrides: [{ eventType: float, quantity: 1 }],
    };

    const afterYoga = adjustClassPassCredits(start, 1, -1);
    expect(afterYoga.ok).toBe(true);
    if (!afterYoga.ok) return;
    expect(afterYoga.pass.quantity).toBe(1);

    const afterSauna = adjustClassPassCredits(afterYoga.pass, sauna, -1);
    expect(afterSauna.ok).toBe(true);
    if (!afterSauna.ok) return;
    expect(afterSauna.pass.quantity).toBe(0);
    expect(afterSauna.pass.eventTypeOverrides.find((row) => row.eventTypes.includes(float))?.quantity).toBe(1);
    expect(afterSauna.pass.status).toBe("active");

    const afterFloat = adjustClassPassCredits(afterSauna.pass, float, -1);
    expect(afterFloat.ok).toBe(true);
    if (!afterFloat.ok) return;
    expect(afterFloat.pass.quantity).toBe(0);
    expect(afterFloat.pass.eventTypeOverrides.find((row) => row.eventTypes.includes(float))?.quantity).toBe(0);
    expect(afterFloat.pass.status).toBe("used");
  });

  it("spends one shared quantity when either yoga type is booked and leaves the sauna row", () => {
    const beginners = 11;
    const fundamentals = 12;
    const pass = {
      quantity: 5,
      status: "active" as const,
      eventTypeOverrides: [
        { eventTypes: [beginners, fundamentals], quantity: 2 },
        { eventType: sauna, quantity: 1 },
      ],
    };

    const afterBeginners = adjustClassPassCredits(pass, beginners, -1);
    expect(afterBeginners.ok).toBe(true);
    if (!afterBeginners.ok) return;
    expect(afterBeginners.pass.quantity).toBe(5);
    expect(afterBeginners.pass.eventTypeOverrides).toEqual([
      { eventTypes: [beginners, fundamentals], quantity: 1 },
      { eventTypes: [sauna], quantity: 1 },
    ]);

    const afterFundamentals = adjustClassPassCredits(afterBeginners.pass, fundamentals, -1);
    expect(afterFundamentals.ok).toBe(true);
    if (!afterFundamentals.ok) return;
    expect(afterFundamentals.pass.eventTypeOverrides).toEqual([
      { eventTypes: [beginners, fundamentals], quantity: 0 },
      { eventTypes: [sauna], quantity: 1 },
    ]);
    expect(afterFundamentals.pass.quantity).toBe(5);
    expect(afterFundamentals.pass.status).toBe("active");

    const third = adjustClassPassCredits(afterFundamentals.pass, beginners, -1);
    expect(third.ok).toBe(false);
  });

  it("refuses to spend or restore the shared pool when the event type is unknown and the pass has an override", () => {
    const spent = adjustClassPassCredits(pass, null, -1);
    expect(spent.ok).toBe(false);

    const restored = adjustClassPassCredits(
      {
        quantity: 0,
        status: "used",
        eventTypeOverrides: [{ eventType: float, quantity: 0 }],
      },
      null,
      1,
    );
    expect(restored.ok).toBe(false);
  });

  it("keeps an expired or cancelled pass in that status when credits remain", () => {
    const expired = adjustClassPassCredits(
      { quantity: 0, status: "expired", eventTypeOverrides: [] },
      sauna,
      1,
    );
    expect(expired.ok).toBe(true);
    if (!expired.ok) return;
    expect(expired.pass.status).toBe("expired");
    expect(expired.pass.quantity).toBe(1);

    const cancelled = adjustClassPassCredits(
      { quantity: 2, status: "cancelled", eventTypeOverrides: [] },
      sauna,
      -1,
    );
    expect(cancelled.ok).toBe(true);
    if (!cancelled.ok) return;
    expect(cancelled.pass.status).toBe("cancelled");
    expect(cancelled.pass.quantity).toBe(1);
  });
});

describe("event type override validation", () => {
  const beginners = 11;
  const fundamentals = 12;
  const sauna = 2;

  it("adds every type on a row to Allowed", () => {
    expect(
      allowedEventTypeIdsIncludingOverrides([sauna], [{ eventTypes: [beginners, fundamentals] }]),
    ).toEqual({
      ids: [sauna, beginners, fundamentals],
      idsToStore: [sauna, beginners, fundamentals],
    });
  });

  it("rejects a type listed on two rows", () => {
    expect(
      validateEventTypeOverrideRows({
        allowedEventTypeIds: [beginners, fundamentals, sauna],
        rows: [
          { eventTypeIds: [beginners, fundamentals], count: 2 },
          { eventTypeIds: [fundamentals, sauna], count: 2 },
        ],
      }),
    ).toBe("Each event type can only be overridden once.");
  });
});
