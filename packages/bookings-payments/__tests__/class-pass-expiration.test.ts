/**
 * Class pass type daysUntilExpiration drives purchased pass expiry (purchase date + N days).
 */
import { describe, it, expect } from "vitest";
import {
  DEFAULT_CLASS_PASS_EXPIRATION_DAYS,
  resolveDaysUntilExpiration,
  classPassExpirationDateOnly,
} from "../src/class-pass/utilities/class-pass-expiration";

describe("class-pass expiration from type", () => {
  it("resolveDaysUntilExpiration returns the type value when valid", () => {
    expect(resolveDaysUntilExpiration({ daysUntilExpiration: 30 })).toBe(30);
    expect(resolveDaysUntilExpiration({ daysUntilExpiration: 1 })).toBe(1);
  });

  it("resolveDaysUntilExpiration floors fractional numbers", () => {
    expect(resolveDaysUntilExpiration({ daysUntilExpiration: 14.7 })).toBe(14);
  });

  it("resolveDaysUntilExpiration falls back when missing or invalid", () => {
    expect(resolveDaysUntilExpiration({})).toBe(DEFAULT_CLASS_PASS_EXPIRATION_DAYS);
    expect(resolveDaysUntilExpiration({ daysUntilExpiration: null })).toBe(
      DEFAULT_CLASS_PASS_EXPIRATION_DAYS,
    );
    expect(resolveDaysUntilExpiration({ daysUntilExpiration: 0 })).toBe(
      DEFAULT_CLASS_PASS_EXPIRATION_DAYS,
    );
    expect(resolveDaysUntilExpiration({ daysUntilExpiration: -3 })).toBe(
      DEFAULT_CLASS_PASS_EXPIRATION_DAYS,
    );
    expect(resolveDaysUntilExpiration({ daysUntilExpiration: NaN })).toBe(
      DEFAULT_CLASS_PASS_EXPIRATION_DAYS,
    );
  });

  it("classPassExpirationDateOnly adds calendar days consistent with setDate + ISO slice", () => {
    const purchasedAt = new Date(2026, 5, 15, 12, 0, 0);
    const expected = new Date(purchasedAt);
    expected.setDate(expected.getDate() + 45);
    expect(classPassExpirationDateOnly(purchasedAt, 45)).toBe(
      expected.toISOString().slice(0, 10),
    );
  });
});
