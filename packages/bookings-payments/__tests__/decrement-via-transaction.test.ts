/**
 * Transaction-driven decrement: when a booking is confirmed and a booking-transaction
 * exists with paymentMethod 'class_pass', the class pass quantity is decremented.
 * When no such transaction exists, no class-pass is updated.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildConfig, getPayload, type Payload } from "payload";
import { config } from "./config";
import { createDbString } from "@repo/testing-config/src/utils/db";
import { setDbString } from "@repo/payload-testing/src/utils/payload-config";
import {
  createDecrementClassPassHook,
  getClassPassIdFromBookingTransaction,
} from "../src";

const HOOK_TIMEOUT = 60000;

describe("decrement via booking-transaction", () => {
  let payload: Payload;

  beforeAll(async () => {
    if (!process.env.DATABASE_URI) {
      const dbString = await createDbString();
      (config as { db: unknown }).db = setDbString(dbString);
    }
    const built = await buildConfig(config);
    const bookingsCol = built.collections?.find(
      (c: { slug?: string }) => c.slug === "bookings"
    ) as { hooks?: { afterChange?: unknown[] } } | undefined;
    if (bookingsCol) {
      const hooks = bookingsCol.hooks ?? {};
      const existing = Array.isArray(hooks.afterChange) ? hooks.afterChange : [];
      bookingsCol.hooks = {
        ...hooks,
        afterChange: [
          ...existing,
          createDecrementClassPassHook({
            getClassPassIdToDecrement: getClassPassIdFromBookingTransaction(),
          }),
        ],
      };
    }
    payload = await getPayload({ config: built });
  }, HOOK_TIMEOUT);

  afterAll(async () => {
    if (payload?.db) await payload.db.destroy();
  });

  it("decrements class pass when booking confirmed and transaction has paymentMethod class_pass", async () => {
    const user = await payload.create({
      collection: "users",
      data: { email: `dec-user-${Date.now()}@test.com`, password: "test" },
      overrideAccess: true,
    });
    const classOption = await payload.create({
      collection: "class-options",
      data: { name: "Dec Class", places: 10, description: "Test" },
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
    const future = new Date(Date.now() + 86400000 * 30);
    const pass = await payload.create({
      collection: "class-passes" as import("payload").CollectionSlug,
      data: {
        user: user.id,
        quantity: 2,
        originalQuantity: 2,
        expirationDate: future.toISOString().slice(0, 10),
        purchasedAt: new Date().toISOString(),
        price: 1999,
        status: "active",
      } as Record<string, unknown>,
      overrideAccess: true,
    });
    const booking = await payload.create({
      collection: "bookings",
      data: { user: user.id, lesson: lesson.id, status: "pending" },
      overrideAccess: true,
    });
    await payload.create({
      collection: "booking-transactions" as import("payload").CollectionSlug,
      data: {
        booking: booking.id,
        paymentMethod: "class_pass",
        classPassId: pass.id,
      } as Record<string, unknown>,
      overrideAccess: true,
    });

    await payload.update({
      collection: "bookings",
      id: booking.id as number,
      data: { status: "confirmed" },
      overrideAccess: true,
    });

    const passAfter = await payload.findByID({
      collection: "class-passes" as import("payload").CollectionSlug,
      id: pass.id as number,
      depth: 0,
    });
    expect((passAfter as { quantity?: number }).quantity).toBe(1);
    expect((passAfter as { status?: string }).status).toBe("active");
  });

  it("sets class pass status to used when quantity reaches 0", async () => {
    const user = await payload.create({
      collection: "users",
      data: { email: `dec2-user-${Date.now()}@test.com`, password: "test" },
      overrideAccess: true,
    });
    const classOption = await payload.create({
      collection: "class-options",
      data: { name: "Dec2 Class", places: 10, description: "Test" },
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
    const future = new Date(Date.now() + 86400000 * 30);
    const pass = await payload.create({
      collection: "class-passes" as import("payload").CollectionSlug,
      data: {
        user: user.id,
        quantity: 1,
        originalQuantity: 1,
        expirationDate: future.toISOString().slice(0, 10),
        purchasedAt: new Date().toISOString(),
        price: 999,
        status: "active",
      } as Record<string, unknown>,
      overrideAccess: true,
    });
    const booking = await payload.create({
      collection: "bookings",
      data: { user: user.id, lesson: lesson.id, status: "pending" },
      overrideAccess: true,
    });
    await payload.create({
      collection: "booking-transactions" as import("payload").CollectionSlug,
      data: {
        booking: booking.id,
        paymentMethod: "class_pass",
        classPassId: pass.id,
      } as Record<string, unknown>,
      overrideAccess: true,
    });

    await payload.update({
      collection: "bookings",
      id: booking.id as number,
      data: { status: "confirmed" },
      overrideAccess: true,
    });

    const passAfter = await payload.findByID({
      collection: "class-passes" as import("payload").CollectionSlug,
      id: pass.id as number,
      depth: 0,
    });
    expect((passAfter as { quantity?: number }).quantity).toBe(0);
    expect((passAfter as { status?: string }).status).toBe("used");
  });

  it("does not decrement when no booking-transaction with class_pass exists", async () => {
    const user = await payload.create({
      collection: "users",
      data: { email: `dec3-user-${Date.now()}@test.com`, password: "test" },
      overrideAccess: true,
    });
    const classOption = await payload.create({
      collection: "class-options",
      data: { name: "Dec3 Class", places: 10, description: "Test" },
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
    const future = new Date(Date.now() + 86400000 * 30);
    const pass = await payload.create({
      collection: "class-passes" as import("payload").CollectionSlug,
      data: {
        user: user.id,
        quantity: 1,
        originalQuantity: 1,
        expirationDate: future.toISOString().slice(0, 10),
        purchasedAt: new Date().toISOString(),
        price: 999,
        status: "active",
      } as Record<string, unknown>,
      overrideAccess: true,
    });
    const booking = await payload.create({
      collection: "bookings",
      data: { user: user.id, lesson: lesson.id, status: "pending" },
      overrideAccess: true,
    });
    // no booking-transaction created

    await payload.update({
      collection: "bookings",
      id: booking.id as number,
      data: { status: "confirmed" },
      overrideAccess: true,
    });

    const passAfter = await payload.findByID({
      collection: "class-passes" as import("payload").CollectionSlug,
      id: pass.id as number,
      depth: 0,
    });
    expect((passAfter as { quantity?: number }).quantity).toBe(1);
    expect((passAfter as { status?: string }).status).toBe("active");
  });
});
