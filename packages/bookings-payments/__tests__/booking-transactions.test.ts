/**
 * Booking-transactions CRUD: create with paymentMethod class_pass or stripe, read back.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildConfig, getPayload, type Payload } from "payload";
import { config } from "./config";
import { createDbString } from "@repo/testing-config/src/utils/db";
import { setDbString } from "@repo/payload-testing/src/utils/payload-config";

const HOOK_TIMEOUT = 60000;

describe("booking-transactions collection", () => {
  let payload: Payload;
  let userId: number;
  let bookingId: number;

  beforeAll(async () => {
    if (!process.env.DATABASE_URI) {
      const dbString = await createDbString();
      (config as { db: unknown }).db = setDbString(dbString);
    }
    const built = await buildConfig(config);
    payload = await getPayload({ config: built });

    const user = await payload.create({
      collection: "users",
      data: { email: `bt-user-${Date.now()}@test.com`, password: "test" },
      overrideAccess: true,
    });
    userId = user.id as number;

    const classOption = await payload.create({
      collection: "class-options",
      data: { name: "BT Class", places: 10, description: "Test" },
      overrideAccess: true,
    });
    const lesson = await payload.create({
      collection: "lessons",
      data: {
        classOption: classOption.id,
        date: new Date().toISOString().slice(0, 10),
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 3600000).toISOString(),
      },
      overrideAccess: true,
    });
    const booking = await payload.create({
      collection: "bookings",
      data: { user: userId, lesson: lesson.id, status: "pending" },
      overrideAccess: true,
    });
    bookingId = booking.id as number;
  }, HOOK_TIMEOUT);

  afterAll(async () => {
    if (payload?.db) await payload.db.destroy();
  });

  it("creates and reads booking-transaction with paymentMethod class_pass", async () => {
    const created = await payload.create({
      collection: "booking-transactions" as import("payload").CollectionSlug,
      data: {
        booking: bookingId,
        paymentMethod: "class_pass",
        classPassId: 999,
      } as Record<string, unknown>,
      overrideAccess: true,
    });
    const bookingRef =
      typeof created.booking === "object" && created.booking && "id" in created.booking
        ? (created.booking as { id: number }).id
        : (created.booking as number);
    expect(bookingRef).toBe(bookingId);
    expect(created.paymentMethod).toBe("class_pass");
    expect((created as { classPassId?: number }).classPassId).toBe(999);

    const read = await payload.findByID({
      collection: "booking-transactions" as import("payload").CollectionSlug,
      id: created.id as number,
      overrideAccess: true,
    });
    expect(read.paymentMethod).toBe("class_pass");
  });

  it("creates booking-transaction with paymentMethod stripe", async () => {
    const booking2 = await payload.create({
      collection: "bookings",
      data: {
        user: userId,
        lesson: (await payload.find({ collection: "lessons", limit: 1, overrideAccess: true })).docs[0].id,
        status: "pending",
      },
      overrideAccess: true,
    });
    const created = await payload.create({
      collection: "booking-transactions" as import("payload").CollectionSlug,
      data: {
        booking: booking2.id,
        paymentMethod: "stripe",
        stripePaymentIntentId: "pi_test_123",
      } as Record<string, unknown>,
      overrideAccess: true,
    });
    expect(created.paymentMethod).toBe("stripe");
    expect((created as { stripePaymentIntentId?: string }).stripePaymentIntentId).toBe("pi_test_123");
  });
});
