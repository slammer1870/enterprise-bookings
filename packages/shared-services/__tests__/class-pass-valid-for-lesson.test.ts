import { describe, expect, it } from "vitest";
import {
  classPassesForPaymentTab,
  filterValidClassPassesForTimeslot,
} from "../src/class-pass-valid-for-lesson";

const now = new Date("2026-06-01T12:00:00.000Z");
const later = "2026-12-01T00:00:00.000Z";

const lesson = {
  tenant: 1,
  eventType: {
    id: 10,
    paymentMethods: { allowedClassPasses: [7] },
  },
};

function pass(overrides: Record<string, unknown>) {
  return {
    id: 1,
    tenant: 1,
    type: { id: 7, allowedEventTypes: [10] },
    status: "active",
    quantity: 2,
    expirationDate: later,
    ...overrides,
  };
}

describe("class pass credits for a lesson", () => {
  it("hides a pass that has some credits but not enough for the quantity", () => {
    const passes = [pass({ id: 2, quantity: 2 })];
    expect(filterValidClassPassesForTimeslot(lesson, passes, now, 3)).toEqual([]);
    expect(classPassesForPaymentTab(lesson, passes, now, 3)).toEqual([]);
  });

  it("keeps a zero-credit row so the payment tab can say those credits are used", () => {
    const spentRow = pass({
      id: 3,
      quantity: 2,
      eventTypeOverrides: [{ eventType: 10, quantity: 0 }],
    });
    const usedPass = pass({ id: 4, status: "used", quantity: 0 });

    expect(filterValidClassPassesForTimeslot(lesson, [spentRow, usedPass], now, 1)).toEqual([]);

    const shown = classPassesForPaymentTab(lesson, [spentRow, usedPass], now, 1);
    expect(shown.map((row) => row.id)).toEqual([3, 4]);
    expect(shown.every((row) => row.creditsForEventType === 0)).toBe(true);
  });

  it("still returns a pass that can cover the quantity", () => {
    const enough = pass({ id: 5, quantity: 3 });
    const shown = classPassesForPaymentTab(lesson, [enough], now, 3);
    expect(shown).toHaveLength(1);
    expect(shown[0]?.creditsForEventType).toBe(3);
  });
});
