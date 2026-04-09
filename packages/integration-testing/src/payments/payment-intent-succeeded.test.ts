/* eslint-disable no-console */
/**
 * Integration tests for the payment intent succeeded webhook handler.
 * Tests that bookings are created when timeslotId is included in the payment intent metadata.
 */

import type { Payload } from "payload";

import { beforeAll, afterAll, describe, expect, it } from "vitest";

import { getPayload } from "payload";

import { buildConfig } from "payload";

import { config } from "../bookings/config";

import { createDbString } from "@repo/testing-config/src/utils/db";

import { setDbString } from "@repo/payload-testing/src/utils/payload-config";
import { User } from "@repo/shared-types";

import { createTimeslot } from "../bookings/timeslot-helpers";

import { paymentIntentSucceeded } from "@repo/bookings-payments";

import type Stripe from "stripe";

let payload: Payload;

const TEST_TIMEOUT = 300000; // 5 minutes

describe("Payment Intent Succeeded Webhook - Timeslot ID Booking Creation", () => {
  beforeAll(async () => {
    if (!process.env.DATABASE_URI) {
      const dbString = await createDbString();

      config.db = setDbString(dbString);
    }

    const builtConfig = await buildConfig(config);

    payload = await getPayload({ config: builtConfig });
  }, TEST_TIMEOUT);

  afterAll(async () => {
    if (payload) {
      await (payload.db as any).destroy();
    }
  });

  it(
    "should create a booking when timeslotId is included in payment intent metadata",
    async () => {
      if (!payload) {
        throw new Error("Payload is not initialized");
      }

      // Create a user with a stripe customer ID
      const user = (await payload.create({
        collection: "users",
        data: {
          email: "payment-test@test.com",
          password: "test",
          stripeCustomerId: "cus_test123",
        },
      })) as User;

      // Create a class option
      const classOption = await payload.create({
        collection: "event-types",
        data: {
          name: "Test Class Option for Payment",
          places: 10,
          description: "Test Class Option for Payment",
        },
      });

      // Create a lesson
      const lesson = await createTimeslot(payload, {
        startHoursOffset: 10, // 10 AM
        durationHours: 1,
        eventType: classOption.id,
        location: "Test Location Payment",
      });

      // Verify no booking exists yet
      const existingBookingsBefore = await payload.find({
        collection: "bookings",
        where: {
          timeslot: { equals: lesson.id },
          user: { equals: user.id },
        },
      });

      expect(existingBookingsBefore.docs.length).toBe(0);

      // Create a mock Stripe PaymentIntent event
      const mockEvent = {
        data: {
          object: {
            id: "pi_test123",
            customer: "cus_test123",
            metadata: {
              timeslotId: lesson.id.toString(),
            },
          } as unknown as Stripe.PaymentIntent,
        },
      };

      // Call the webhook handler
      if (!payload) {
        throw new Error("Payload is not initialized");
      }

      await paymentIntentSucceeded({
        event: mockEvent as any,
        payload,
      });

      // Verify a booking was created
      const bookingsAfter = await payload.find({
        collection: "bookings",
        where: {
          timeslot: { equals: lesson.id },
          user: { equals: user.id },
        },
        depth: 0, // Get IDs only, not populated objects
      });

      expect(bookingsAfter.docs.length).toBe(1);
      expect(bookingsAfter.docs[0]?.status).toBe("confirmed");
      const lessonId =
        typeof bookingsAfter.docs[0]?.timeslot === "object"
          ? bookingsAfter.docs[0]?.timeslot?.id
          : bookingsAfter.docs[0]?.timeslot;
      const userId =
        typeof bookingsAfter.docs[0]?.user === "object"
          ? bookingsAfter.docs[0]?.user?.id
          : bookingsAfter.docs[0]?.user;
      expect(lessonId).toBe(lesson.id);
      expect(userId).toBe(user.id);
    },
    TEST_TIMEOUT
  );

  it(
    "should update existing booking to confirmed when timeslotId is included and booking already exists",
    async () => {
      if (!payload) {
        throw new Error("Payload is not initialized");
      }

      // Create a user with a stripe customer ID
      const user = (await payload.create({
        collection: "users",
        data: {
          email: "payment-test-update@test.com",
          password: "test",
          stripeCustomerId: "cus_test456",
        },
      })) as User;

      // Create a class option
      const classOption = await payload.create({
        collection: "event-types",
        data: {
          name: "Test Class Option for Payment Update",
          places: 10,
          description: "Test Class Option for Payment Update",
        },
      });

      // Create a lesson
      const lesson = await createTimeslot(payload, {
        startHoursOffset: 11, // 11 AM
        durationHours: 1,
        eventType: classOption.id,
        location: "Test Location Payment Update",
      });

      // Create an existing booking with pending status
      const existingBooking = await payload.create({
        collection: "bookings",
        data: {
          timeslot: lesson.id,
          user: user.id,
          status: "pending",
        },
      });

      expect(existingBooking.status).toBe("pending");

      // Create a mock Stripe PaymentIntent event
      const mockEvent = {
        data: {
          object: {
            id: "pi_test456",
            customer: "cus_test456",
            metadata: {
              timeslotId: lesson.id.toString(),
            },
          } as unknown as Stripe.PaymentIntent,
        },
      };

      // Call the webhook handler
      await paymentIntentSucceeded({
        event: mockEvent as any,
        payload,
      });

      // Verify the booking was updated to confirmed
      const updatedBooking = await payload.findByID({
        collection: "bookings",
        id: existingBooking.id,
        depth: 0, // Get IDs only, not populated objects
      });

      expect(updatedBooking.status).toBe("confirmed");
      const lessonId =
        typeof updatedBooking.timeslot === "object"
          ? updatedBooking.timeslot?.id
          : updatedBooking.timeslot;
      const userId =
        typeof updatedBooking.user === "object"
          ? updatedBooking.user?.id
          : updatedBooking.user;
      expect(lessonId).toBe(lesson.id);
      expect(userId).toBe(user.id);

      // Verify only one booking exists (not duplicated)
      const allBookings = await payload.find({
        collection: "bookings",
        where: {
          timeslot: { equals: lesson.id },
          user: { equals: user.id },
        },
      });

      expect(allBookings.docs.length).toBe(1);
    },
    TEST_TIMEOUT
  );

  it(
    "should not create booking when user is not found",
    async () => {
      if (!payload) {
        throw new Error("Payload is not initialized");
      }

      // Create a class option
      const classOption = await payload.create({
        collection: "event-types",
        data: {
          name: "Test Class Option for Payment No User",
          places: 10,
          description: "Test Class Option for Payment No User",
        },
      });

      // Create a lesson
      const lesson = await createTimeslot(payload, {
        startHoursOffset: 12, // 12 PM
        durationHours: 1,
        eventType: classOption.id,
        location: "Test Location Payment No User",
      });

      // Create a mock Stripe PaymentIntent event with non-existent customer
      const mockEvent = {
        data: {
          object: {
            id: "pi_test789",
            customer: "cus_nonexistent",
            metadata: {
              timeslotId: lesson.id.toString(),
            },
          } as unknown as Stripe.PaymentIntent,
        },
      };

      // Call the webhook handler
      await paymentIntentSucceeded({
        event: mockEvent as any,
        payload,
      });

      // Verify no booking was created
      const bookings = await payload.find({
        collection: "bookings",
        where: {
          timeslot: { equals: lesson.id },
        },
      });

      expect(bookings.docs.length).toBe(0);
    },
    TEST_TIMEOUT
  );

  it(
    "should update multiple bookings for the same lesson to confirmed when bookingIds are included",
    async () => {
      if (!payload) {
        throw new Error("Payload is not initialized");
      }

      // Create a user with a stripe customer ID (e.g., parent booking for multiple people)
      const user = (await payload.create({
        collection: "users",
        data: {
          email: "payment-test-same-lesson@test.com",
          password: "test",
          stripeCustomerId: "cus_test_same_lesson",
        },
      })) as User;

      // Create additional users (e.g., children or guests)
      const user2 = (await payload.create({
        collection: "users",
        data: {
          email: "payment-test-same-lesson-2@test.com",
          password: "test",
        },
      })) as User;

      const user3 = (await payload.create({
        collection: "users",
        data: {
          email: "payment-test-same-lesson-3@test.com",
          password: "test",
        },
      })) as User;

      // Create a class option
      const classOption = await payload.create({
        collection: "event-types",
        data: {
          name: "Test Class Option for Same Timeslot Bookings",
          places: 10,
          description: "Test Class Option for Same Timeslot Bookings",
        },
      });

      // Create a single lesson
      const lesson = await createTimeslot(payload, {
        startHoursOffset: 16, // 4 PM
        durationHours: 1,
        eventType: classOption.id,
        location: "Test Location Same Timeslot",
      });

      // Create multiple bookings for the same lesson (different users)
      const booking1 = await payload.create({
        collection: "bookings",
        data: {
          timeslot: lesson.id,
          user: user.id,
          status: "pending",
        },
      });

      const booking2 = await payload.create({
        collection: "bookings",
        data: {
          timeslot: lesson.id,
          user: user2.id,
          status: "pending",
        },
      });

      const booking3 = await payload.create({
        collection: "bookings",
        data: {
          timeslot: lesson.id,
          user: user3.id,
          status: "pending",
        },
      });

      // Verify all bookings are pending and for the same lesson
      expect(booking1.status).toBe("pending");
      expect(booking2.status).toBe("pending");
      expect(booking3.status).toBe("pending");

      const lesson1Id =
        typeof booking1.timeslot === "object"
          ? booking1.timeslot?.id
          : booking1.timeslot;
      const lesson2Id =
        typeof booking2.timeslot === "object"
          ? booking2.timeslot?.id
          : booking2.timeslot;
      const lesson3Id =
        typeof booking3.timeslot === "object"
          ? booking3.timeslot?.id
          : booking3.timeslot;

      expect(lesson1Id).toBe(lesson.id);
      expect(lesson2Id).toBe(lesson.id);
      expect(lesson3Id).toBe(lesson.id);

      // Create a mock Stripe PaymentIntent event with multiple booking IDs for the same lesson
      const mockEvent = {
        data: {
          object: {
            id: "pi_test_same_lesson",
            customer: "cus_test_same_lesson",
            metadata: {
              bookingIds: `${booking1.id},${booking2.id},${booking3.id}`,
            },
          } as unknown as Stripe.PaymentIntent,
        },
      };

      // Call the webhook handler
      await paymentIntentSucceeded({
        event: mockEvent as any,
        payload,
      });

      // Verify all bookings were updated to confirmed
      const updatedBooking1 = await payload.findByID({
        collection: "bookings",
        id: booking1.id,
        depth: 0,
      });

      const updatedBooking2 = await payload.findByID({
        collection: "bookings",
        id: booking2.id,
        depth: 0,
      });

      const updatedBooking3 = await payload.findByID({
        collection: "bookings",
        id: booking3.id,
        depth: 0,
      });

      expect(updatedBooking1.status).toBe("confirmed");
      expect(updatedBooking2.status).toBe("confirmed");
      expect(updatedBooking3.status).toBe("confirmed");

      // Verify all bookings are still for the same lesson
      const updatedTimeslot1Id =
        typeof updatedBooking1.timeslot === "object"
          ? updatedBooking1.timeslot?.id
          : updatedBooking1.timeslot;
      const updatedTimeslot2Id =
        typeof updatedBooking2.timeslot === "object"
          ? updatedBooking2.timeslot?.id
          : updatedBooking2.timeslot;
      const updatedTimeslot3Id =
        typeof updatedBooking3.timeslot === "object"
          ? updatedBooking3.timeslot?.id
          : updatedBooking3.timeslot;

      expect(updatedTimeslot1Id).toBe(lesson.id);
      expect(updatedTimeslot2Id).toBe(lesson.id);
      expect(updatedTimeslot3Id).toBe(lesson.id);

      // Verify all bookings are linked to their respective users
      const updatedUser1Id =
        typeof updatedBooking1.user === "object"
          ? updatedBooking1.user?.id
          : updatedBooking1.user;
      const updatedUser2Id =
        typeof updatedBooking2.user === "object"
          ? updatedBooking2.user?.id
          : updatedBooking2.user;
      const updatedUser3Id =
        typeof updatedBooking3.user === "object"
          ? updatedBooking3.user?.id
          : updatedBooking3.user;

      expect(updatedUser1Id).toBe(user.id);
      expect(updatedUser2Id).toBe(user2.id);
      expect(updatedUser3Id).toBe(user3.id);

      // Verify all bookings exist for the lesson
      const allBookingsForTimeslot = await payload.find({
        collection: "bookings",
        where: {
          timeslot: { equals: lesson.id },
        },
        depth: 0,
      });

      expect(allBookingsForTimeslot.docs.length).toBeGreaterThanOrEqual(3);

      // Verify all confirmed bookings for this lesson
      const confirmedBookings = allBookingsForTimeslot.docs.filter(
        (booking) => booking.status === "confirmed"
      );
      expect(confirmedBookings.length).toBeGreaterThanOrEqual(3);
    },
    TEST_TIMEOUT
  );

  it(
    "should create multiple bookings when timeslotId and quantity are in payment intent metadata",
    async () => {
      if (!payload) {
        throw new Error("Payload is not initialized");
      }

      const user = (await payload.create({
        collection: "users",
        data: {
          email: "payment-test-quantity@test.com",
          password: "test",
          stripeCustomerId: "cus_test_quantity",
        },
      })) as User;

      const classOption = await payload.create({
        collection: "event-types",
        data: {
          name: "Test Class Option for Quantity",
          places: 10,
          description: "Test Class Option for Quantity",
        },
      });

      const lesson = await createTimeslot(payload, {
        startHoursOffset: 14,
        durationHours: 1,
        eventType: classOption.id,
        location: "Test Location Quantity",
      });

      const existingBefore = await payload.find({
        collection: "bookings",
        where: {
          timeslot: { equals: lesson.id },
          user: { equals: user.id },
        },
      });
      expect(existingBefore.docs.length).toBe(0);

      const mockEvent = {
        data: {
          object: {
            id: "pi_test_quantity",
            customer: "cus_test_quantity",
            metadata: {
              timeslotId: lesson.id.toString(),
              quantity: "2",
            },
          } as unknown as Stripe.PaymentIntent,
        },
      };

      await paymentIntentSucceeded({
        event: mockEvent as any,
        payload,
      });

      const bookingsAfter = await payload.find({
        collection: "bookings",
        where: {
          timeslot: { equals: lesson.id },
          user: { equals: user.id },
        },
        depth: 0,
      });

      expect(bookingsAfter.docs.length).toBe(2);
      expect(bookingsAfter.docs.every((b) => b.status === "confirmed")).toBe(true);
    },
    TEST_TIMEOUT
  );

  it(
    "should cap created bookings to remainingCapacity when quantity in metadata exceeds capacity",
    async () => {
      if (!payload) {
        throw new Error("Payload is not initialized");
      }

      const user = (await payload.create({
        collection: "users",
        data: {
          email: "payment-test-cap@test.com",
          password: "test",
          stripeCustomerId: "cus_test_cap",
        },
      })) as User;

      const otherUser = (await payload.create({
        collection: "users",
        data: {
          email: "payment-test-cap-other@test.com",
          password: "test",
        },
      })) as User;

      const classOption = await payload.create({
        collection: "event-types",
        data: {
          name: "Test Class Option for Cap",
          places: 2,
          description: "Test Class Option for Cap",
        },
      });

      const lesson = await createTimeslot(payload, {
        startHoursOffset: 15,
        durationHours: 1,
        eventType: classOption.id,
        location: "Test Location Cap",
      });

      await payload.create({
        collection: "bookings",
        data: {
          timeslot: lesson.id,
          user: otherUser.id,
          status: "confirmed",
        },
      });

      const existingForUser = await payload.find({
        collection: "bookings",
        where: {
          timeslot: { equals: lesson.id },
          user: { equals: user.id },
        },
      });
      expect(existingForUser.docs.length).toBe(0);

      const mockEvent = {
        data: {
          object: {
            id: "pi_test_cap",
            customer: "cus_test_cap",
            metadata: {
              timeslotId: lesson.id.toString(),
              quantity: "2",
            },
          } as unknown as Stripe.PaymentIntent,
        },
      };

      await paymentIntentSucceeded({
        event: mockEvent as any,
        payload,
      });

      const bookingsAfter = await payload.find({
        collection: "bookings",
        where: {
          timeslot: { equals: lesson.id },
          user: { equals: user.id },
        },
        depth: 0,
      });

      expect(bookingsAfter.docs.length).toBe(1);
      expect(bookingsAfter.docs[0]?.status).toBe("confirmed");

      const allForTimeslot = await payload.find({
        collection: "bookings",
        where: { timeslot: { equals: lesson.id } },
        depth: 0,
      });
      const confirmedCount = allForTimeslot.docs.filter((b) => b.status === "confirmed").length;
      expect(confirmedCount).toBe(2);
    },
    TEST_TIMEOUT
  );
});
