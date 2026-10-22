import { describe, expect, it } from "vitest";
import {
  adjustClassPassCredits,
  displayQuantityForClassPassType,
  snapshotClassPassCredits,
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
    expect(snapshot.eventTypeOverrides).toEqual([{ eventType: float, quantity: 1 }]);
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
        { eventType: sauna, quantity: 2 },
        { eventType: float, quantity: 3 },
      ],
    });
    expect(displayQuantityForClassPassType(type, 9)).toBe(5);
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
      { eventType: sauna, quantity: 1 },
      { eventType: float, quantity: 0 },
    ]);
    expect(spent.pass.status).toBe("active");

    const second = adjustClassPassCredits(spent.pass, float, -1);
    expect(second.ok).toBe(false);

    const restored = adjustClassPassCredits(spent.pass, float, 1);
    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    expect(restored.pass.eventTypeOverrides.find((row) => row.eventType === float)?.quantity).toBe(1);
    expect(restored.pass.eventTypeOverrides.find((row) => row.eventType === sauna)?.quantity).toBe(1);
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
    expect(afterSauna.pass.eventTypeOverrides.find((row) => row.eventType === float)?.quantity).toBe(1);
    expect(afterSauna.pass.status).toBe("active");

    const afterFloat = adjustClassPassCredits(afterSauna.pass, float, -1);
    expect(afterFloat.ok).toBe(true);
    if (!afterFloat.ok) return;
    expect(afterFloat.pass.quantity).toBe(0);
    expect(afterFloat.pass.eventTypeOverrides.find((row) => row.eventType === float)?.quantity).toBe(0);
    expect(afterFloat.pass.status).toBe("used");
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
