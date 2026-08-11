import { describe, expect, it } from "vitest";
import {
  formatCancelRefundMessage,
  getCancelRefundPreview,
  isWithinRefundWindow,
  resolveRefundWindowHours,
  shouldRefundOnCancel,
} from "../src/refund-policy";
import { computePartialRefundAmountCents } from "../src/cancel-refund-policy";

describe("resolveRefundWindowHours", () => {
  it("returns null when default unset and inherit", () => {
    expect(resolveRefundWindowHours({})).toBeNull();
    expect(
      resolveRefundWindowHours({ defaultWindowHours: null, override: { mode: "inherit" } }),
    ).toBeNull();
  });

  it("inherits default hours", () => {
    expect(
      resolveRefundWindowHours({
        defaultWindowHours: 24,
        override: { mode: "inherit" },
      }),
    ).toBe(24);
  });

  it("never overrides default", () => {
    expect(
      resolveRefundWindowHours({
        defaultWindowHours: 24,
        override: { mode: "never" },
      }),
    ).toBeNull();
  });

  it("uses custom hours when mode is custom", () => {
    expect(
      resolveRefundWindowHours({
        defaultWindowHours: 24,
        override: { mode: "custom", windowHours: 12 },
      }),
    ).toBe(12);
  });

  it("returns null for custom with empty hours", () => {
    expect(
      resolveRefundWindowHours({
        defaultWindowHours: 24,
        override: { mode: "custom", windowHours: null },
      }),
    ).toBeNull();
  });

  it("allows 0 hours (until start)", () => {
    expect(resolveRefundWindowHours({ defaultWindowHours: 0 })).toBe(0);
    expect(
      resolveRefundWindowHours({
        override: { mode: "custom", windowHours: 0 },
      }),
    ).toBe(0);
  });
});

describe("isWithinRefundWindow", () => {
  const start = new Date("2026-08-11T12:00:00.000Z");

  it("is false when hours unset", () => {
    expect(
      isWithinRefundWindow({
        refundWindowHours: null,
        timeslotStart: start,
        now: new Date("2026-08-10T12:00:00.000Z"),
      }),
    ).toBe(false);
  });

  it("is true inside a 24h window", () => {
    expect(
      isWithinRefundWindow({
        refundWindowHours: 24,
        timeslotStart: start,
        now: new Date("2026-08-10T11:00:00.000Z"),
      }),
    ).toBe(true);
  });

  it("is true at the exact boundary", () => {
    expect(
      isWithinRefundWindow({
        refundWindowHours: 24,
        timeslotStart: start,
        now: new Date("2026-08-10T12:00:00.000Z"),
      }),
    ).toBe(true);
  });

  it("is false just outside the window", () => {
    expect(
      isWithinRefundWindow({
        refundWindowHours: 24,
        timeslotStart: start,
        now: new Date("2026-08-10T12:00:00.001Z"),
      }),
    ).toBe(false);
  });

  it("with 0 hours allows any time before/at start", () => {
    expect(
      isWithinRefundWindow({
        refundWindowHours: 0,
        timeslotStart: start,
        now: new Date("2026-08-11T11:59:59.000Z"),
      }),
    ).toBe(true);
    expect(
      isWithinRefundWindow({
        refundWindowHours: 0,
        timeslotStart: start,
        now: new Date("2026-08-11T12:00:00.001Z"),
      }),
    ).toBe(false);
  });
});

describe("shouldRefundOnCancel / getCancelRefundPreview", () => {
  const start = "2026-08-11T12:00:00.000Z";
  const inside = new Date("2026-08-10T11:00:00.000Z");

  it("drop-in never + class pass inherit 24", () => {
    const policy = {
      defaultWindowHours: 24,
      advanced: {
        dropIn: { mode: "never" as const },
        classPass: { mode: "inherit" as const },
      },
    };
    expect(
      shouldRefundOnCancel({
        policy,
        paymentMethod: "stripe",
        timeslotStart: start,
        now: inside,
      }),
    ).toBe(false);
    expect(
      shouldRefundOnCancel({
        policy,
        paymentMethod: "class_pass",
        timeslotStart: start,
        now: inside,
      }),
    ).toBe(true);
  });

  it("class pass custom 12 with empty default", () => {
    const policy = {
      defaultWindowHours: null,
      advanced: {
        classPass: { mode: "custom" as const, windowHours: 12 },
      },
    };
    // 13h before start → inside 12h? No. 14h before → inside.
    expect(
      shouldRefundOnCancel({
        policy,
        paymentMethod: "class_pass",
        timeslotStart: start,
        now: new Date("2026-08-10T22:00:00.000Z"), // 14h before
      }),
    ).toBe(true);
    expect(
      shouldRefundOnCancel({
        policy,
        paymentMethod: "class_pass",
        timeslotStart: start,
        now: new Date("2026-08-11T01:00:00.000Z"), // 11h before
      }),
    ).toBe(false);
    expect(
      shouldRefundOnCancel({
        policy,
        paymentMethod: "stripe",
        timeslotStart: start,
        now: new Date("2026-08-10T22:00:00.000Z"),
      }),
    ).toBe(false);
  });

  it("subscription never refunds in v1", () => {
    expect(
      shouldRefundOnCancel({
        policy: { defaultWindowHours: 24 },
        paymentMethod: "subscription",
        timeslotStart: start,
        now: inside,
      }),
    ).toBe(false);
  });

  it("preview message reflects refund kind", () => {
    const preview = getCancelRefundPreview({
      policy: { defaultWindowHours: 24 },
      paymentMethod: "stripe",
      timeslotStart: start,
      now: inside,
    });
    expect(preview.willRefund).toBe(true);
    expect(preview.kind).toBe("stripe");
    expect(formatCancelRefundMessage(preview)).toMatch(/refunded/i);
  });
});

describe("computePartialRefundAmountCents", () => {
  it("splits evenly and gives remainder to last sibling", () => {
    expect(
      computePartialRefundAmountCents({
        paymentIntentAmountCents: 1000,
        siblingCount: 3,
        alreadyRefundedCount: 0,
      }),
    ).toBe(333);
    expect(
      computePartialRefundAmountCents({
        paymentIntentAmountCents: 1000,
        siblingCount: 3,
        alreadyRefundedCount: 1,
      }),
    ).toBe(333);
    expect(
      computePartialRefundAmountCents({
        paymentIntentAmountCents: 1000,
        siblingCount: 3,
        alreadyRefundedCount: 2,
      }),
    ).toBe(334);
  });

  it("full amount for a single booking", () => {
    expect(
      computePartialRefundAmountCents({
        paymentIntentAmountCents: 2500,
        siblingCount: 1,
        alreadyRefundedCount: 0,
      }),
    ).toBe(2500);
  });
});
