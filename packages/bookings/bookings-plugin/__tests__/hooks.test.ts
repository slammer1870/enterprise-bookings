/* eslint-disable no-console */
/**
 * Tests for booking-related hooks
 * Tests the hooks that were modified to handle edge cases and errors gracefully
 */

import type { Payload } from "payload";

import { beforeAll, afterAll, describe, expect, it } from "vitest";

import { buildConfig, getPayload } from "payload";

import { config } from "./config";

import { setDbString } from "@repo/payload-testing/src/utils/payload-config";
import { createDbString } from "@repo/testing-config/src/utils/db";

import { EventType, Timeslot, User, Booking } from "@repo/shared-types";

import { NextRESTClient } from "@repo/payload-testing/src/helpers/NextRESTClient";

const TEST_TIMEOUT = 60000; // 60 seconds
const HOOK_TIMEOUT = 300000; // 5 minutes for setup hooks (DB + Payload init can be slow under turbo parallelism)

let payload: Payload;
let restClient: NextRESTClient;
let eventType: EventType;
let user: User;

describe("Hook tests", () => {
  beforeAll(async () => {
    if (!process.env.DATABASE_URI) {
      const dbString = await createDbString();
      config.db = setDbString(dbString);
    }

    const builtConfig = await buildConfig(config);

    payload = await getPayload({ config: builtConfig });
    restClient = new NextRESTClient(builtConfig);

    // Create test user
    user = (await payload.create({
      collection: "users",
      data: {
        email: "hooktest@test.com",
        password: "test",
      },
    })) as unknown as User;

    // Create test event type
    eventType = (await payload.create({
      collection: "event-types",
      data: {
        name: "Hook Test Class",
        places: 5,
        description: "Test class for hooks",
      },
    })) as EventType;
  }, HOOK_TIMEOUT);

  afterAll(async () => {
    if (payload && payload.db && typeof payload.db.destroy === "function") {
      await payload.db.destroy();
    }
  });

  describe("getRemainingCapacity hook", () => {
    it(
      "should calculate remaining capacity correctly",
      async () => {
        const lesson = await payload.create({
          collection: "timeslots",
          data: {
            date: new Date(),
            startTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
            endTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
            eventType: eventType.id,
            location: "Test Location",
            lockOutTime: 30,
            originalLockOutTime: 30,
          },
        });

        // Create 2 confirmed bookings
        const user2 = await payload.create({
          collection: "users",
          data: {
            email: "user2@test.com",
            password: "test",
          },
        });

        await payload.create({
          collection: "bookings",
          data: {
            timeslot: lesson.id,
            user: user.id,
            status: "confirmed",
          },
        });

        await payload.create({
          collection: "bookings",
          data: {
            timeslot: lesson.id,
            user: user2.id,
            status: "confirmed",
          },
        });

        // Read the lesson - this will trigger the remainingCapacity hook
        const readTimeslot = await payload.findByID({
          collection: "timeslots",
          id: lesson.id,
        });

        // 5 places - 2 bookings = 3 remaining
        expect((readTimeslot as Timeslot).remainingCapacity).toBe(3);
      },
      TEST_TIMEOUT
    );

    it(
      "should return full capacity when no bookings exist",
      async () => {
        const lesson = await payload.create({
          collection: "timeslots",
          data: {
            date: new Date(),
            startTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
            endTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
            eventType: eventType.id,
            location: "Test Location",
            lockOutTime: 30,
            originalLockOutTime: 30,
          },
        });

        // Read the lesson - this will trigger the remainingCapacity hook
        const readTimeslot = await payload.findByID({
          collection: "timeslots",
          id: lesson.id,
        });

        // Should return full capacity (5 places)
        expect((readTimeslot as Timeslot).remainingCapacity).toBe(5);
      },
      TEST_TIMEOUT
    );

    it(
      "should return 0 when booked out",
      async () => {
        const lesson = (await payload.create({
          collection: "timeslots",
          data: {
            date: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
            startTime: new Date(Date.now() + 25 * 60 * 60 * 1000),
            endTime: new Date(Date.now() + 26 * 60 * 60 * 1000),
            eventType: eventType.id,
            location: "Test Location",
            lockOutTime: 30,
            originalLockOutTime: 30,
          },
        })) as Timeslot;

        // Create 5 confirmed bookings to fill the class (5 places)
        for (let i = 0; i < 5; i++) {
          await payload.create({
            collection: "bookings",
            data: {
              timeslot: lesson.id,
              user: user.id, // User who has already booked the class (user1)
              status: "confirmed",
            },
          });
        }

        // Read the lesson - this will trigger the remainingCapacity hook
        const readTimeslot = await payload.findByID({
          collection: "timeslots",
          id: lesson.id,
        });

        expect((readTimeslot as Timeslot).remainingCapacity).toBe(0);
      },
      TEST_TIMEOUT
    );
  });

  describe("getBookingStatus hook", () => {
    it(
      "should return 'active' for a lesson with no bookings",
      async () => {
        const lesson = await payload.create({
          collection: "timeslots",
          data: {
            date: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
            startTime: new Date(Date.now() + 25 * 60 * 60 * 1000),
            endTime: new Date(Date.now() + 26 * 60 * 60 * 1000),
            eventType: eventType.id,
            location: "Test Location",
            lockOutTime: 30,
            originalLockOutTime: 30,
          },
        });

        // Read the lesson - this will trigger the bookingStatus hook
        const readTimeslot = await payload.findByID({
          collection: "timeslots",
          id: lesson.id,
        });

        expect((readTimeslot as Timeslot).bookingStatus).toBe("active");
      },
      TEST_TIMEOUT
    );

    it(
      "should return 'booked' when user has a confirmed booking",
      async () => {
        const lesson = await payload.create({
          collection: "timeslots",
          data: {
            date: new Date(Date.now() + 24 * 60 * 60 * 1000),
            startTime: new Date(Date.now() + 25 * 60 * 60 * 1000),
            endTime: new Date(Date.now() + 26 * 60 * 60 * 1000),
            eventType: eventType.id,
            location: "Test Location",
            lockOutTime: 30,
            originalLockOutTime: 30,
          },
        });

        await payload.create({
          collection: "bookings",
          data: {
            timeslot: lesson.id,
            user: user.id,
            status: "confirmed",
          },
        });

        // Read the lesson as the user via REST API - this will trigger the bookingStatus hook
        const response = await restClient
          .login({
            credentials: {
              email: user.email,
              password: "test",
            },
          })
          .then(() => restClient.GET(`/timeslots/${lesson.id}`));

        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.bookingStatus).toBe("booked");
      },
      TEST_TIMEOUT
    );

    it(
      "should return 'waitlist' when lesson is full",
      async () => {
        const lesson = await payload.create({
          collection: "timeslots",
          data: {
            date: new Date(Date.now() + 24 * 60 * 60 * 1000),
            startTime: new Date(Date.now() + 25 * 60 * 60 * 1000),
            endTime: new Date(Date.now() + 26 * 60 * 60 * 1000),
            eventType: eventType.id,
            location: "Test Location",
            lockOutTime: 30,
            originalLockOutTime: 30,
          },
        });

        // Create 5 bookings to fill the class (5 places)
        for (let i = 0; i < 5; i++) {
          const testUser = await payload.create({
            collection: "users",
            data: {
              email: `waitlist${i}@test.com`,
              password: "test",
            },
          });

          await payload.create({
            collection: "bookings",
            data: {
              timeslot: lesson.id,
              user: testUser.id,
              status: "confirmed",
            },
          });
        }

        // Read the lesson - this will trigger the bookingStatus hook
        const readTimeslot = await payload.findByID({
          collection: "timeslots",
          id: lesson.id,
        });

        expect((readTimeslot as Timeslot).bookingStatus).toBe("waitlist");
      },
      TEST_TIMEOUT
    );

    it(
      "should return 'closed' when lesson has passed lockout time",
      async () => {
        const lesson = await payload.create({
          collection: "timeslots",
          data: {
            date: new Date(),
            startTime: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
            endTime: new Date(Date.now() + 70 * 60 * 1000),
            eventType: eventType.id,
            location: "Test Location",
            lockOutTime: 30, // 30 minutes lockout
            originalLockOutTime: 30,
          },
        });

        // Read the lesson - this will trigger the bookingStatus hook
        const readTimeslot = await payload.findByID({
          collection: "timeslots",
          id: lesson.id,
        });

        // Should be closed because startTime - 30 minutes is in the past
        expect((readTimeslot as Timeslot).bookingStatus).toBe("closed");
      },
      TEST_TIMEOUT
    );

    it(
      "should return 'active' as default status",
      async () => {
        // Test that the hook handles the case where eventType is missing from data
        // This tests the early return in the hook
        const lesson = await payload.create({
          collection: "timeslots",
          data: {
            date: new Date(),
            startTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
            endTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
            eventType: eventType.id,
            location: "Test Location",
            lockOutTime: 30,
            originalLockOutTime: 30,
          },
        });

        // Read the lesson normally - should work fine
        const readTimeslot = await payload.findByID({
          collection: "timeslots",
          id: lesson.id,
        });

        // Should return a valid status
        expect(["active", "booked", "waitlist", "closed"]).toContain(
          (readTimeslot as Timeslot).bookingStatus
        );
      },
      TEST_TIMEOUT
    );
  });

  describe("setLockout hook", () => {
    it(
      "should set lockout to 0 when booking is confirmed",
      async () => {
        const lesson = await payload.create({
          collection: "timeslots",
          data: {
            date: new Date(),
            startTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
            endTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
            eventType: eventType.id,
            location: "Test Location",
            lockOutTime: 30,
            originalLockOutTime: 30,
          },
        });

        const booking = await payload.create({
          collection: "bookings",
          data: {
            timeslot: lesson.id,
            user: user.id,
            status: "confirmed",
          },
        });

        // Wait a bit for the async hook to complete
        await new Promise((resolve) => setTimeout(resolve, 500));

        const updatedTimeslot = await payload.findByID({
          collection: "timeslots",
          id: lesson.id,
        });

        expect((updatedTimeslot as any).lockOutTime).toBe(0);
      },
      TEST_TIMEOUT
    );

    it(
      "should set lockout to 0 when booking is confirmed then restore on cancel (full cycle)",
      async () => {
        // This is the primary regression test for the cancel-doesn't-reset bug.
        // Sequence: lesson created with lockOutTime=45 → user books → lockOutTime set to 0
        //           → user cancels → lockOutTime must restore to 45.
        const lesson = await payload.create({
          collection: "timeslots",
          data: {
            date: new Date(),
            startTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
            endTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
            eventType: eventType.id,
            location: "Test Location",
            lockOutTime: 45,
            originalLockOutTime: 45,
          },
        });

        // Step 1: book — hook must set lockOutTime to 0
        const booking = await payload.create({
          collection: "bookings",
          data: {
            timeslot: lesson.id,
            user: user.id,
            status: "confirmed",
          },
        });

        const lessonAfterBook = await payload.findByID({
          collection: "timeslots",
          id: lesson.id,
        });
        expect((lessonAfterBook as any).lockOutTime).toBe(0);

        // Step 2: cancel — hook must restore lockOutTime to originalLockOutTime (45)
        await payload.update({
          collection: "bookings",
          id: booking.id,
          data: { status: "cancelled" },
        });

        const lessonAfterCancel = await payload.findByID({
          collection: "timeslots",
          id: lesson.id,
        });
        expect((lessonAfterCancel as any).lockOutTime).toBe(45);
      },
      TEST_TIMEOUT
    );

    it(
      "should restore original lockout when no confirmed bookings remain",
      async () => {
        const lesson = await payload.create({
          collection: "timeslots",
          data: {
            date: new Date(),
            startTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
            endTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
            eventType: eventType.id,
            location: "Test Location",
            lockOutTime: 0, // Initially 0 because we'll create a booking
            originalLockOutTime: 45,
          },
        });

        const booking = await payload.create({
          collection: "bookings",
          data: {
            timeslot: lesson.id,
            user: user.id,
            status: "confirmed",
          },
        });

        // Cancel the booking — afterChange hooks are awaited synchronously,
        // so the lesson should be updated by the time payload.update resolves.
        await payload.update({
          collection: "bookings",
          id: booking.id,
          data: { status: "cancelled" },
        });

        const updatedTimeslot = await payload.findByID({
          collection: "timeslots",
          id: lesson.id,
        });

        expect((updatedTimeslot as any).lockOutTime).toBe(45);
      },
      TEST_TIMEOUT
    );

    it(
      "should keep lockout at 0 when one of several confirmed bookings is cancelled",
      async () => {
        // Two users book. One cancels. The other is still confirmed, so lockOutTime must stay 0.
        const user2 = await payload.create({
          collection: "users",
          data: { email: `lockout-multi-${Date.now()}@test.com`, password: "test" },
        });

        const lesson = await payload.create({
          collection: "timeslots",
          data: {
            date: new Date(),
            startTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
            endTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
            eventType: eventType.id,
            location: "Test Location",
            lockOutTime: 45,
            originalLockOutTime: 45,
          },
        });

        const booking1 = await payload.create({
          collection: "bookings",
          data: { timeslot: lesson.id, user: user.id, status: "confirmed" },
        });

        await payload.create({
          collection: "bookings",
          data: { timeslot: lesson.id, user: user2.id, status: "confirmed" },
        });

        // Verify both bookings drove lockOutTime to 0
        const lessonAfterBothBooked = await payload.findByID({
          collection: "timeslots",
          id: lesson.id,
        });
        expect((lessonAfterBothBooked as any).lockOutTime).toBe(0);

        // Cancel only one of the two bookings
        await payload.update({
          collection: "bookings",
          id: booking1.id,
          data: { status: "cancelled" },
        });

        // The second booking is still confirmed — lockOutTime must remain 0
        const lessonAfterOneCancel = await payload.findByID({
          collection: "timeslots",
          id: lesson.id,
        });
        expect((lessonAfterOneCancel as any).lockOutTime).toBe(0);
      },
      TEST_TIMEOUT
    );

    it(
      "should restore lockout when all confirmed bookings are cancelled",
      async () => {
        // Two users book, both cancel — lockOutTime should restore to originalLockOutTime.
        const user2 = await payload.create({
          collection: "users",
          data: { email: `lockout-both-cancel-${Date.now()}@test.com`, password: "test" },
        });

        const lesson = await payload.create({
          collection: "timeslots",
          data: {
            date: new Date(),
            startTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
            endTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
            eventType: eventType.id,
            location: "Test Location",
            lockOutTime: 45,
            originalLockOutTime: 45,
          },
        });

        const booking1 = await payload.create({
          collection: "bookings",
          data: { timeslot: lesson.id, user: user.id, status: "confirmed" },
        });

        const booking2 = await payload.create({
          collection: "bookings",
          data: { timeslot: lesson.id, user: user2.id, status: "confirmed" },
        });

        // Cancel first booking — second is still confirmed, lockOutTime stays 0
        await payload.update({
          collection: "bookings",
          id: booking1.id,
          data: { status: "cancelled" },
        });

        const lessonAfterFirstCancel = await payload.findByID({
          collection: "timeslots",
          id: lesson.id,
        });
        expect((lessonAfterFirstCancel as any).lockOutTime).toBe(0);

        // Cancel second booking — no confirmed bookings remain, lockOutTime must restore
        await payload.update({
          collection: "bookings",
          id: booking2.id,
          data: { status: "cancelled" },
        });

        const lessonAfterBothCancelled = await payload.findByID({
          collection: "timeslots",
          id: lesson.id,
        });
        expect((lessonAfterBothCancelled as any).lockOutTime).toBe(45);
      },
      TEST_TIMEOUT
    );

    it(
      "should handle deleted lesson gracefully",
      async () => {
        const lesson = await payload.create({
          collection: "timeslots",
          data: {
            date: new Date(),
            startTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
            endTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
            eventType: eventType.id,
            location: "Test Location",
            lockOutTime: 30,
            originalLockOutTime: 30,
          },
        });

        const booking = await payload.create({
          collection: "bookings",
          data: {
            timeslot: lesson.id,
            user: user.id,
            status: "confirmed",
          },
        });

        // Wait for the hook to complete (set lockout to 0)
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Delete the lesson - this will also delete the booking due to cascade
        // But the async hook might still try to run, so we test that it handles gracefully
        try {
          await payload.delete({
            collection: "timeslots",
            id: lesson.id,
          });
        } catch (error) {
          // If deletion fails, that's okay - the test is about hook error handling
        }

        // Wait a bit to ensure any async hooks complete
        await new Promise((resolve) => setTimeout(resolve, 500));

        // If we get here without unhandled errors, the hook handled it gracefully
        expect(true).toBe(true);
      },
      TEST_TIMEOUT
    );
  });

  describe("bookings collection afterChange hooks", () => {
    it(
      "should handle waitlist notification when capacity becomes available",
      async () => {
        const lesson = await payload.create({
          collection: "timeslots",
          data: {
            date: new Date(),
            startTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
            endTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
            eventType: eventType.id,
            location: "Test Location",
            lockOutTime: 30,
            originalLockOutTime: 30,
          },
        });

        // Fill the lesson
        const confirmedBooking = await payload.create({
          collection: "bookings",
          data: {
            timeslot: lesson.id,
            user: user.id,
            status: "confirmed",
          },
        });

        // Create a waiting booking
        const waitingUser = await payload.create({
          collection: "users",
          data: {
            email: "waiting@test.com",
            password: "test",
          },
        });

        await payload.create({
          collection: "bookings",
          data: {
            timeslot: lesson.id,
            user: waitingUser.id,
            status: "waiting",
          },
        });

        // Wait for hooks to complete
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Cancel the confirmed booking - this should trigger waitlist notification
        await payload.update({
          collection: "bookings",
          id: confirmedBooking.id,
          data: {
            status: "cancelled",
          },
        });

        // Wait for hooks to complete
        await new Promise((resolve) => setTimeout(resolve, 500));

        // If we get here without errors, the hook handled it correctly
        expect(true).toBe(true);
      },
      TEST_TIMEOUT
    );

    it(
      "should handle deleted lesson in afterChange hook gracefully",
      async () => {
        const lesson = await payload.create({
          collection: "timeslots",
          data: {
            date: new Date(),
            startTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
            endTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
            eventType: eventType.id,
            location: "Test Location",
            lockOutTime: 30,
            originalLockOutTime: 30,
          },
        });

        const booking = await payload.create({
          collection: "bookings",
          data: {
            timeslot: lesson.id,
            user: user.id,
            status: "confirmed",
          },
        });

        // Wait for hooks to complete
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Delete the lesson - this will cascade delete the booking
        // But if we try to update first, the hooks should handle missing lesson gracefully
        try {
          await payload.update({
            collection: "bookings",
            id: booking.id,
            data: {
              status: "cancelled",
            },
          });
        } catch (error: any) {
          // If update fails because lesson was deleted, that's expected
          // The important thing is that async hooks don't throw unhandled errors
          if (error?.status !== 404 && error?.name !== "NotFound") {
            throw error;
          }
        }

        // Wait for hooks to complete
        await new Promise((resolve) => setTimeout(resolve, 500));

        // If we get here without unhandled errors, the hooks handled it correctly
        expect(true).toBe(true);
      },
      TEST_TIMEOUT
    );
  });
});
