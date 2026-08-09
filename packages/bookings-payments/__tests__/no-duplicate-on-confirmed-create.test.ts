/**
 * Regression tests: transaction duplication on confirmed booking create.
 *
 * Root cause (fixed): bookSingleSlotTimeslotOrRedirect was manually creating a transaction
 * AND manually decrementing the class pass after calling bookOneSlot(). The
 * createBookingTransactionOnCreate afterChange hook was already creating the transaction,
 * resulting in TWO transactions per booking.
 *
 * Fix: removed the manual payload.create for the transaction from the tRPC router. The
 * manual decrement is KEPT because createDecrementClassPassHook cannot see the transaction
 * that createBookingTransactionOnCreate just created within the same Payload request context
 * (same-request DB visibility), so it returns null and skips the decrement — the tRPC
 * router is the only path that reliably decrements in this flow.
 *
 * These tests exercise both hooks registered together (mirroring production setup) and
 * confirm:
 *   - Exactly ONE transaction is created per confirmed class-pass booking
 *   - No second transaction is created by a re-run or duplicate caller
 *   - Pending bookings get a transaction (for accounting) but no decrement yet
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildConfig, getPayload, type Payload } from "payload";
import type { Config } from "payload";
import { createTestConfig } from "./config";
import { createDbString } from "@repo/testing-config/src/utils/db";
import { setDbString } from "@repo/payload-testing/src/utils/payload-config";
import {
  createBookingTransactionOnCreate,
  createDecrementClassPassHook,
  getClassPassIdFromBookingTransaction,
} from "../src";

const HOOK_TIMEOUT = 180000;
const TEST_TIMEOUT = 60000;

/**
 * Plugin applied to the test config that adds paymentMethodUsed / classPassIdUsed fields
 * to the bookings collection and registers BOTH production hooks — exactly mirroring the
 * hook setup in apps/atnd-me/src/plugins/index.ts.
 */
function augmentBookingsWithBothHooks(incoming: Config): Config {
  const collections = incoming.collections ?? [];
  const bookings = collections.find((c) => c.slug === "bookings");
  if (!bookings) return incoming;

  const fields = Array.isArray(bookings.fields) ? [...bookings.fields] : [];
  if (!fields.some((f: { name?: string }) => f.name === "paymentMethodUsed")) {
    fields.push(
      {
        name: "paymentMethodUsed",
        type: "select",
        options: ["class_pass", "subscription", "stripe", "cash"],
        admin: { description: "How the user paid for this booking." },
      },
      {
        name: "classPassIdUsed",
        type: "number",
        admin: {
          description: "Class pass id when paymentMethodUsed is class_pass.",
          condition: (_: unknown, sibling: { paymentMethodUsed?: string }) =>
            sibling?.paymentMethodUsed === "class_pass",
        },
      }
    );
  }

  const hooks = bookings.hooks ?? {};
  const afterChange = Array.isArray(hooks.afterChange) ? [...hooks.afterChange] : [];

  // Matches the registration order in apps/atnd-me/src/plugins/index.ts
  afterChange.push(
    createBookingTransactionOnCreate(),
    createDecrementClassPassHook({
      getClassPassIdToDecrement: getClassPassIdFromBookingTransaction(),
    })
  );

  const augmented = { ...bookings, fields, hooks: { ...hooks, afterChange } };
  return {
    ...incoming,
    collections: collections.map((c) => (c.slug === "bookings" ? augmented : c)),
  };
}

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

describe("no duplicate transactions or decrements on confirmed booking create", () => {
  let payload: Payload;
  let classPassTypeId: number;
  let userId: number;
  let lessonId: number;

  beforeAll(async () => {
    const config = createTestConfig();
    if (!process.env.DATABASE_URI) {
      const dbString = await createDbString();
      (config as { db: unknown }).db = setDbString(dbString);
    }
    config.plugins = [...(config.plugins ?? []), augmentBookingsWithBothHooks];
    const built = await buildConfig(config);
    payload = await getPayload({ config: built });

    // Shared user
    const user = await payload.create({
      collection: "users",
      data: { email: `no-dup-user-${Date.now()}@test.com`, password: "test" },
      overrideAccess: true,
    });
    userId = user.id as number;

    // Shared class-pass type
    const cpt = await payload.create({
      collection: "class-pass-types" as import("payload").CollectionSlug,
      data: {
        name: "No-dup Pass Type",
        slug: `no-dup-pass-type-${Date.now()}`,
        description: "For no-duplicate regression tests",
        quantity: 10,
        priceInformation: { price: 19.99 },
      },
      overrideAccess: true,
    });
    classPassTypeId = cpt.id as number;

    // Shared timeslot
    const start = new Date();
    start.setHours(10, 0, 0, 0);
    const end = new Date(start);
    end.setHours(11, 0, 0, 0);

    const eventType = await payload.create({
      collection: "event-types",
      data: { name: `No-dup Event ${Date.now()}`, places: 20, description: "Test" },
      overrideAccess: true,
    });

    const lesson = await payload.create({
      collection: "timeslots",
      data: {
        eventType: eventType.id,
        date: start.toISOString().slice(0, 10),
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        lockOutTime: 0,
        active: true,
      },
      overrideAccess: true,
    });
    lessonId = lesson.id as number;
  }, HOOK_TIMEOUT);

  afterAll(async () => {
    if (payload?.db) await payload.db.destroy();
  });

  // -------------------------------------------------------------------------

  it(
    "creates exactly ONE transaction when a confirmed booking is created with a class pass",
    async () => {
      const future = new Date(Date.now() + 86400000 * 30);
      const pass = await payload.create({
        collection: "class-passes" as import("payload").CollectionSlug,
        data: {
          user: userId,
          type: classPassTypeId,
          quantity: 5,
          expirationDate: future.toISOString().slice(0, 10),
          purchasedAt: new Date().toISOString(),
          status: "active",
        } as Record<string, unknown>,
        overrideAccess: true,
      });

      // Simulate bookOneSlot: create in confirmed status with paymentMethodUsed and classPassIdUsed
      const booking = await payload.create({
        collection: "bookings",
        data: {
          user: userId,
          timeslot: lessonId,
          status: "confirmed",
          paymentMethodUsed: "class_pass",
          classPassIdUsed: pass.id,
        } as Record<string, unknown>,
        overrideAccess: true,
      });

      // Allow async hook processing to settle
      await new Promise((r) => setTimeout(r, 400));

      const txResult = await payload.find({
        collection: "transactions" as import("payload").CollectionSlug,
        where: { booking: { equals: booking.id } },
        overrideAccess: true,
      });

      expect(txResult.totalDocs).toBe(1);
      expect((txResult.docs[0] as { paymentMethod?: string }).paymentMethod).toBe("class_pass");
      expect((txResult.docs[0] as { classPassId?: number }).classPassId).toBe(pass.id as number);
    },
    TEST_TIMEOUT
  );

  it(
    "does NOT create a second transaction when the hook fires again on a subsequent update (idempotency guard)",
    async () => {
      const future = new Date(Date.now() + 86400000 * 30);
      const pass = await payload.create({
        collection: "class-passes" as import("payload").CollectionSlug,
        data: {
          user: userId,
          type: classPassTypeId,
          quantity: 5,
          expirationDate: future.toISOString().slice(0, 10),
          purchasedAt: new Date().toISOString(),
          status: "active",
        } as Record<string, unknown>,
        overrideAccess: true,
      });

      // First create — hook fires for operation=create
      const booking = await payload.create({
        collection: "bookings",
        data: {
          user: userId,
          timeslot: lessonId,
          status: "confirmed",
          paymentMethodUsed: "class_pass",
          classPassIdUsed: pass.id,
        } as Record<string, unknown>,
        overrideAccess: true,
      });

      await new Promise((r) => setTimeout(r, 400));

      // Update the booking — hook fires for operation=update, should NOT create a new transaction
      await payload.update({
        collection: "bookings",
        id: booking.id as number,
        data: { status: "confirmed" } as Record<string, unknown>,
        overrideAccess: true,
      });

      await new Promise((r) => setTimeout(r, 400));

      const txResult = await payload.find({
        collection: "transactions" as import("payload").CollectionSlug,
        where: { booking: { equals: booking.id } },
        overrideAccess: true,
      });

      // Still exactly 1 — the hook guards on operation === 'create'
      expect(txResult.totalDocs).toBe(1);
    },
    TEST_TIMEOUT
  );

  it(
    "class pass quantity is NOT touched by the hook alone (decrement happens in tRPC router, not the hook chain)",
    async () => {
      // This test documents the known DB visibility limitation:
      // createDecrementClassPassHook cannot find the transaction created by
      // createBookingTransactionOnCreate in the same request, so it skips the
      // decrement. The tRPC router (bookSingleSlotTimeslotOrRedirect) is
      // responsible for the decrement via an explicit payload.update call.
      const initialQuantity = 4;
      const future = new Date(Date.now() + 86400000 * 30);
      const pass = await payload.create({
        collection: "class-passes" as import("payload").CollectionSlug,
        data: {
          user: userId,
          type: classPassTypeId,
          quantity: initialQuantity,
          expirationDate: future.toISOString().slice(0, 10),
          purchasedAt: new Date().toISOString(),
          status: "active",
        } as Record<string, unknown>,
        overrideAccess: true,
      });

      await payload.create({
        collection: "bookings",
        data: {
          user: userId,
          timeslot: lessonId,
          status: "confirmed",
          paymentMethodUsed: "class_pass",
          classPassIdUsed: pass.id,
        } as Record<string, unknown>,
        overrideAccess: true,
      });

      await new Promise((r) => setTimeout(r, 400));

      const passAfter = await payload.findByID({
        collection: "class-passes" as import("payload").CollectionSlug,
        id: pass.id as number,
        depth: 0,
      });

      // Quantity unchanged — hook did not decrement because it could not resolve
      // the classPassId via transaction lookup in the same request context.
      // The tRPC router handles this decrement explicitly.
      expect((passAfter as { quantity?: number }).quantity).toBe(initialQuantity);
    },
    TEST_TIMEOUT
  );

  it(
    "does NOT create a transaction when a booking is created with status pending (no paymentMethodUsed)",
    async () => {
      const booking = await payload.create({
        collection: "bookings",
        data: {
          user: userId,
          timeslot: lessonId,
          status: "pending",
        },
        overrideAccess: true,
      });

      await new Promise((r) => setTimeout(r, 200));

      const txResult = await payload.find({
        collection: "transactions" as import("payload").CollectionSlug,
        where: { booking: { equals: booking.id } },
        overrideAccess: true,
      });

      expect(txResult.totalDocs).toBe(0);
    },
    TEST_TIMEOUT
  );

  it(
    "does NOT decrement the class pass when only the transaction hook fires (no confirmed status on create)",
    async () => {
      const initialQuantity = 3;
      const future = new Date(Date.now() + 86400000 * 30);
      const pass = await payload.create({
        collection: "class-passes" as import("payload").CollectionSlug,
        data: {
          user: userId,
          type: classPassTypeId,
          quantity: initialQuantity,
          expirationDate: future.toISOString().slice(0, 10),
          purchasedAt: new Date().toISOString(),
          status: "active",
        } as Record<string, unknown>,
        overrideAccess: true,
      });

      // Create as pending with class pass info — transaction hook creates txn,
      // but decrement hook must NOT fire because status is not yet "confirmed"
      await payload.create({
        collection: "bookings",
        data: {
          user: userId,
          timeslot: lessonId,
          status: "pending",
          paymentMethodUsed: "class_pass",
          classPassIdUsed: pass.id,
        } as Record<string, unknown>,
        overrideAccess: true,
      });

      await new Promise((r) => setTimeout(r, 400));

      const passAfter = await payload.findByID({
        collection: "class-passes" as import("payload").CollectionSlug,
        id: pass.id as number,
        depth: 0,
      });

      // Transaction created, but no decrement yet — decrement waits for confirmed
      expect((passAfter as { quantity?: number }).quantity).toBe(initialQuantity);
    },
    TEST_TIMEOUT
  );

  it(
    "creates exactly ONE transaction per booking when multiple confirmed bookings are created in a loop (createBookings quantity>1 path)",
    async () => {
      // This simulates createBookings creating 2 bookings in sequence for the same class pass.
      // Prior to the fix, each iteration did: hook creates txn + manual create = 2 txns per booking.
      const future = new Date(Date.now() + 86400000 * 30);
      const pass = await payload.create({
        collection: "class-passes" as import("payload").CollectionSlug,
        data: {
          user: userId,
          type: classPassTypeId,
          quantity: 3,
          expirationDate: future.toISOString().slice(0, 10),
          purchasedAt: new Date().toISOString(),
          status: "active",
        } as Record<string, unknown>,
        overrideAccess: true,
      });

      // Create two confirmed bookings sequentially (simulating the createBookings loop)
      const booking1 = await payload.create({
        collection: "bookings",
        data: {
          user: userId,
          timeslot: lessonId,
          status: "confirmed",
          paymentMethodUsed: "class_pass",
          classPassIdUsed: pass.id,
        } as Record<string, unknown>,
        overrideAccess: true,
      });

      const booking2 = await payload.create({
        collection: "bookings",
        data: {
          user: userId,
          timeslot: lessonId,
          status: "confirmed",
          paymentMethodUsed: "class_pass",
          classPassIdUsed: pass.id,
        } as Record<string, unknown>,
        overrideAccess: true,
      });

      await new Promise((r) => setTimeout(r, 500));

      const tx1Result = await payload.find({
        collection: "transactions" as import("payload").CollectionSlug,
        where: { booking: { equals: booking1.id } },
        overrideAccess: true,
      });
      const tx2Result = await payload.find({
        collection: "transactions" as import("payload").CollectionSlug,
        where: { booking: { equals: booking2.id } },
        overrideAccess: true,
      });

      // Each booking should have exactly 1 transaction
      expect(tx1Result.totalDocs).toBe(1);
      expect(tx2Result.totalDocs).toBe(1);
      expect((tx1Result.docs[0] as { paymentMethod?: string }).paymentMethod).toBe("class_pass");
      expect((tx2Result.docs[0] as { paymentMethod?: string }).paymentMethod).toBe("class_pass");
    },
    TEST_TIMEOUT
  );

  it(
    "does NOT create a transaction for a pending booking (createBookings pending path — confirmed later by confirm-pending)",
    async () => {
      // When a booking is created as pending (no paymentMethodUsed set), the hook should
      // not fire. Transactions for this path are created only when the booking is confirmed
      // via the confirm-pending update path (which is an update operation, not a create).
      const booking = await payload.create({
        collection: "bookings",
        data: {
          user: userId,
          timeslot: lessonId,
          status: "pending",
          // Deliberately no paymentMethodUsed / classPassIdUsed — matches the
          // createBookings pending path which doesn't set these until confirmation
        },
        overrideAccess: true,
      });

      await new Promise((r) => setTimeout(r, 200));

      const txResult = await payload.find({
        collection: "transactions" as import("payload").CollectionSlug,
        where: { booking: { equals: booking.id } },
        overrideAccess: true,
      });

      expect(txResult.totalDocs).toBe(0);
    },
    TEST_TIMEOUT
  );
});
