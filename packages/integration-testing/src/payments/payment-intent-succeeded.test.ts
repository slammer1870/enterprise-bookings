/* eslint-disable no-console */
/**
 * Integration tests for the payment intent succeeded webhook handler.
 * Tests that bookings are created when a lessonId is included in the payment intent metadata.
 */

import type { Payload } from "payload";

import { beforeAll, afterAll, describe, expect, it } from "vitest";

import { getPayload } from "payload";

import { buildConfig } from "payload";

import { config } from "../bookings/config";

import { createDbString } from "@repo/testing-config/src/utils/db";

import { setDbString } from "@repo/testing-config/src/utils/payload-config";
import { User } from "@repo/shared-types";

import { createLesson } from "../bookings/lesson-helpers";

import { paymentIntentSucceeded } from "@repo/payments-plugin";

import type Stripe from "stripe";

let payload: Payload;

const TEST_TIMEOUT = 300000; // 5 minutes

describe("Payment Intent Succeeded Webhook - Lesson ID Booking Creation", () => {
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
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      await (payload.db as any).destroy();
    }
  });

  it(
    "should create a booking when lessonId is included in payment intent metadata",
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
        collection: "class-options",
        data: {
          name: "Test Class Option for Payment",
          places: 10,
          description: "Test Class Option for Payment",
        },
      });

      // Create a lesson
      const lesson = await createLesson(payload, {
        startHoursOffset: 10, // 10 AM
        durationHours: 1,
        classOption: classOption.id,
        location: "Test Location Payment",
      });

      // Verify no booking exists yet
      const existingBookingsBefore = await payload.find({
        collection: "bookings",
        where: {
          lesson: { equals: lesson.id },
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
              lessonId: lesson.id.toString(),
            },
          } as unknown as Stripe.PaymentIntent,
        },
      };

      // Call the webhook handler
      if (!payload) {
        throw new Error("Payload is not initialized");
      }

      await paymentIntentSucceeded({
        event: mockEvent,
        payload,
      });

      // Verify a booking was created
      const bookingsAfter = await payload.find({
        collection: "bookings",
        where: {
          lesson: { equals: lesson.id },
          user: { equals: user.id },
        },
        depth: 0, // Get IDs only, not populated objects
      });

      expect(bookingsAfter.docs.length).toBe(1);
      expect(bookingsAfter.docs[0].status).toBe("confirmed");
      const lessonId =
        typeof bookingsAfter.docs[0].lesson === "object"
          ? bookingsAfter.docs[0].lesson?.id
          : bookingsAfter.docs[0].lesson;
      const userId =
        typeof bookingsAfter.docs[0].user === "object"
          ? bookingsAfter.docs[0].user?.id
          : bookingsAfter.docs[0].user;
      expect(lessonId).toBe(lesson.id);
      expect(userId).toBe(user.id);
    },
    TEST_TIMEOUT
  );

  it(
    "should update existing booking to confirmed when lessonId is included and booking already exists",
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
        collection: "class-options",
        data: {
          name: "Test Class Option for Payment Update",
          places: 10,
          description: "Test Class Option for Payment Update",
        },
      });

      // Create a lesson
      const lesson = await createLesson(payload, {
        startHoursOffset: 11, // 11 AM
        durationHours: 1,
        classOption: classOption.id,
        location: "Test Location Payment Update",
      });

      // Create an existing booking with pending status
      const existingBooking = await payload.create({
        collection: "bookings",
        data: {
          lesson: lesson.id,
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
              lessonId: lesson.id.toString(),
            },
          } as unknown as Stripe.PaymentIntent,
        },
      };

      // Call the webhook handler
      await paymentIntentSucceeded({
        event: mockEvent,
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
        typeof updatedBooking.lesson === "object"
          ? updatedBooking.lesson?.id
          : updatedBooking.lesson;
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
          lesson: { equals: lesson.id },
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
        collection: "class-options",
        data: {
          name: "Test Class Option for Payment No User",
          places: 10,
          description: "Test Class Option for Payment No User",
        },
      });

      // Create a lesson
      const lesson = await createLesson(payload, {
        startHoursOffset: 12, // 12 PM
        durationHours: 1,
        classOption: classOption.id,
        location: "Test Location Payment No User",
      });

      // Create a mock Stripe PaymentIntent event with non-existent customer
      const mockEvent = {
        data: {
          object: {
            id: "pi_test789",
            customer: "cus_nonexistent",
            metadata: {
              lessonId: lesson.id.toString(),
            },
          } as unknown as Stripe.PaymentIntent,
        },
      };

      // Call the webhook handler
      await paymentIntentSucceeded({
        event: mockEvent,
        payload,
      });

      // Verify no booking was created
      const bookings = await payload.find({
        collection: "bookings",
        where: {
          lesson: { equals: lesson.id },
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
        collection: "class-options",
        data: {
          name: "Test Class Option for Same Lesson Bookings",
          places: 10,
          description: "Test Class Option for Same Lesson Bookings",
        },
      });

      // Create a single lesson
      const lesson = await createLesson(payload, {
        startHoursOffset: 16, // 4 PM
        durationHours: 1,
        classOption: classOption.id,
        location: "Test Location Same Lesson",
      });

      // Create multiple bookings for the same lesson (different users)
      const booking1 = await payload.create({
        collection: "bookings",
        data: {
          lesson: lesson.id,
          user: user.id,
          status: "pending",
        },
      });

      const booking2 = await payload.create({
        collection: "bookings",
        data: {
          lesson: lesson.id,
          user: user2.id,
          status: "pending",
        },
      });

      const booking3 = await payload.create({
        collection: "bookings",
        data: {
          lesson: lesson.id,
          user: user3.id,
          status: "pending",
        },
      });

      // Verify all bookings are pending and for the same lesson
      expect(booking1.status).toBe("pending");
      expect(booking2.status).toBe("pending");
      expect(booking3.status).toBe("pending");

      const lesson1Id =
        typeof booking1.lesson === "object"
          ? booking1.lesson?.id
          : booking1.lesson;
      const lesson2Id =
        typeof booking2.lesson === "object"
          ? booking2.lesson?.id
          : booking2.lesson;
      const lesson3Id =
        typeof booking3.lesson === "object"
          ? booking3.lesson?.id
          : booking3.lesson;

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
        event: mockEvent,
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
      const updatedLesson1Id =
        typeof updatedBooking1.lesson === "object"
          ? updatedBooking1.lesson?.id
          : updatedBooking1.lesson;
      const updatedLesson2Id =
        typeof updatedBooking2.lesson === "object"
          ? updatedBooking2.lesson?.id
          : updatedBooking2.lesson;
      const updatedLesson3Id =
        typeof updatedBooking3.lesson === "object"
          ? updatedBooking3.lesson?.id
          : updatedBooking3.lesson;

      expect(updatedLesson1Id).toBe(lesson.id);
      expect(updatedLesson2Id).toBe(lesson.id);
      expect(updatedLesson3Id).toBe(lesson.id);

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
      const allBookingsForLesson = await payload.find({
        collection: "bookings",
        where: {
          lesson: { equals: lesson.id },
        },
        depth: 0,
      });

      expect(allBookingsForLesson.docs.length).toBeGreaterThanOrEqual(3);

      // Verify all confirmed bookings for this lesson
      const confirmedBookings = allBookingsForLesson.docs.filter(
        (booking) => booking.status === "confirmed"
      );
      expect(confirmedBookings.length).toBeGreaterThanOrEqual(3);
    },
    TEST_TIMEOUT
  );
});
