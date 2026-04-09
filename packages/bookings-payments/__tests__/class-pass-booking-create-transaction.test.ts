/**
 * When a booking is created with paymentMethodUsed 'class_pass' and classPassIdUsed,
 * createBookingTransactionOnCreate creates a booking-transaction with paymentMethod 'class_pass' and classPassId.
 * Ported from atnd-me tests/int/class-pass-booking-create-transaction.int.spec.ts
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildConfig, getPayload, type Payload } from "payload";
import type { Config } from "payload";
import { config as baseConfig } from "./config";
import { createDbString } from "@repo/testing-config/src/utils/db";
import { setDbString } from "@repo/payload-testing/src/utils/payload-config";
import { createBookingTransactionOnCreate } from "../src";

const HOOK_TIMEOUT = 120000;
const TEST_TIMEOUT = 60000;

/** Plugin that adds paymentMethodUsed, classPassIdUsed and createBookingTransactionOnCreate to bookings so the hook runs. */
function augmentBookingsForCreateTransaction(incoming: Config): Config {
  const collections = incoming.collections ?? [];
  const bookings = collections.find((c) => c.slug === "bookings");
  if (!bookings) return incoming;
  const fields = Array.isArray(bookings.fields) ? [...bookings.fields] : [];
  if (!fields.some((f: { name?: string }) => f.name === "paymentMethodUsed")) {
    fields.push(
      {
        name: "paymentMethodUsed",
        type: "select",
        options: ["class_pass", "stripe", "cash"],
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
  afterChange.push(createBookingTransactionOnCreate());
  const augmentedBookings = { ...bookings, fields, hooks: { ...hooks, afterChange } };
  return {
    ...incoming,
    collections: collections.map((c) => (c.slug === "bookings" ? augmentedBookings : c)),
  };
}

describe("Class-pass booking create → booking-transaction", () => {
  let payload: Payload;
  let userId: number;
  let classOptionId: number;
  let lessonId: number;
  let classPassId: number;
  let classPassTypeId: number;

  beforeAll(async () => {
    const config = { ...baseConfig };
    if (!process.env.DATABASE_URI) {
      const dbString = await createDbString();
      (config as { db: unknown }).db = setDbString(dbString);
    }
    config.plugins = [...(config.plugins ?? []), augmentBookingsForCreateTransaction];
    const built = await buildConfig(config);
    payload = await getPayload({ config: built });

    const cpt = await payload.create({
      collection: "class-pass-types" as import("payload").CollectionSlug,
      data: {
        name: "CP Tx Pass",
        slug: `cp-tx-pass-${Date.now()}`,
        description: "For create-transaction test",
        quantity: 5,
        priceInformation: { price: 29.99 },
      },
      overrideAccess: true,
    });
    classPassTypeId = cpt.id as number;

    const user = await payload.create({
      collection: "users",
      data: {
        email: `cp-tx-user-${Date.now()}@test.com`,
        password: "test",
      },
      overrideAccess: true,
    });
    userId = user.id as number;

    const co = await payload.create({
      collection: "event-types",
      data: {
        name: `CP Tx Class ${Date.now()}`,
        places: 10,
        description: "Test",
      },
      overrideAccess: true,
    });
    classOptionId = co.id as number;

    const start = new Date();
    start.setHours(14, 0, 0, 0);
    const end = new Date(start);
    end.setHours(15, 0, 0, 0);
    const lesson = await payload.create({
      collection: "timeslots",
      data: {
        classOption: classOptionId,
        date: start.toISOString().slice(0, 10),
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        lockOutTime: 0,
        active: true,
      },
      overrideAccess: true,
    });
    lessonId = lesson.id as number;

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
    classPassId = pass.id as number;
  }, HOOK_TIMEOUT);

  afterAll(async () => {
    if (payload?.db) {
      try {
        await payload.delete({
          collection: "class-passes" as import("payload").CollectionSlug,
          where: { id: { equals: classPassId } },
          overrideAccess: true,
        });
        await payload.delete({
          collection: "class-pass-types" as import("payload").CollectionSlug,
          where: { id: { equals: classPassTypeId } },
          overrideAccess: true,
        });
        await payload.delete({
          collection: "timeslots",
          where: { id: { equals: lessonId } },
          overrideAccess: true,
        });
        await payload.delete({
          collection: "event-types",
          where: { id: { equals: classOptionId } },
          overrideAccess: true,
        });
        await payload.delete({
          collection: "users",
          where: { id: { equals: userId } },
          overrideAccess: true,
        });
      } catch {
        // ignore
      }
      await payload.db.destroy();
    }
  });

  it(
    "creates a booking-transaction with paymentMethod class_pass when booking is created with paymentMethodUsed and classPassIdUsed",
    async () => {
      const booking = await payload.create({
        collection: "bookings",
        data: {
          user: userId,
          lesson: lessonId,
          status: "pending",
          paymentMethodUsed: "class_pass",
          classPassIdUsed: classPassId,
        } as Record<string, unknown>,
        overrideAccess: true,
      });

      await new Promise((r) => setTimeout(r, 400));
      const txResult = await payload.find({
        collection: "transactions" as import("payload").CollectionSlug,
        where: { booking: { equals: booking.id } },
        overrideAccess: true,
      });
      expect(txResult.docs).toHaveLength(1);
      expect((txResult.docs[0] as { paymentMethod?: string }).paymentMethod).toBe("class_pass");
      expect((txResult.docs[0] as { classPassId?: number }).classPassId).toBe(classPassId);

      await payload.delete({
        collection: "transactions" as import("payload").CollectionSlug,
        where: { booking: { equals: booking.id } },
        overrideAccess: true,
      });
      await payload.delete({
        collection: "bookings",
        id: booking.id as number,
        overrideAccess: true,
      });
    },
    TEST_TIMEOUT
  );

  it(
    "does not create a booking-transaction when booking is created without paymentMethodUsed class_pass",
    async () => {
      const booking = await payload.create({
        collection: "bookings",
        data: {
          user: userId,
          lesson: lessonId,
          status: "pending",
        },
        overrideAccess: true,
      });

      const txResult = await payload.find({
        collection: "transactions" as import("payload").CollectionSlug,
        where: { booking: { equals: booking.id } },
        overrideAccess: true,
      });
      expect(txResult.docs).toHaveLength(0);

      await payload.delete({
        collection: "bookings",
        id: booking.id as number,
        overrideAccess: true,
      });
    },
    TEST_TIMEOUT
  );
});
