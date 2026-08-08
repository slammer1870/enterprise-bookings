import { describe, expect, it } from "vitest";
import {
  bookingUserLabel,
  bookingUserOptionLabel,
} from "../src/utils/booking-user-label";

describe("bookingUserLabel", () => {
  it("prefers name over email", () => {
    expect(bookingUserLabel({ id: 1, name: "Sam", email: "sam@example.com" })).toBe(
      "Sam",
    );
  });

  it("uses name when email is stripped by field access", () => {
    expect(bookingUserLabel({ id: 1, name: "Sam", email: undefined })).toBe("Sam");
    expect(bookingUserLabel({ id: 1, name: "Sam" })).toBe("Sam");
  });

  it("uses email when name is missing", () => {
    expect(bookingUserLabel({ id: 1, email: "sam@example.com" })).toBe("sam@example.com");
  });

  it("never interpolates missing fields as the string undefined", () => {
    const label = bookingUserLabel({ id: 42, name: undefined, email: undefined });
    expect(label).toBe("User #42");
    expect(label).not.toContain("undefined");
  });

  it("falls back for bare ids", () => {
    expect(bookingUserLabel(7)).toBe("User #7");
  });
});

describe("bookingUserOptionLabel", () => {
  it("includes email when both are readable", () => {
    expect(
      bookingUserOptionLabel({ id: 1, name: "Sam", email: "sam@example.com" }),
    ).toBe("Sam – sam@example.com");
  });

  it("omits the email segment when email is stripped", () => {
    expect(bookingUserOptionLabel({ id: 1, name: "Sam", email: undefined })).toBe(
      "Sam",
    );
    expect(bookingUserOptionLabel({ id: 1, name: "Sam" })).toBe("Sam");
  });

  it("never interpolates missing fields as the string undefined", () => {
    const label = bookingUserOptionLabel({
      id: 42,
      name: undefined,
      email: undefined,
    });
    expect(label).toBe("User #42");
    expect(label).not.toContain("undefined");
  });
});
