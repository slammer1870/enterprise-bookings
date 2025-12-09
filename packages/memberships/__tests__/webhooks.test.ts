/* eslint-disable no-console */
/**
 * Integration tests for subscription webhook handlers
 */

import type { Payload } from "payload";
import type Stripe from "stripe";

import { beforeAll, describe, expect, it, beforeEach, afterEach, vi } from "vitest";

import { buildConfig, getPayload } from "payload";

import { config } from "./config.js";

import { setDbString } from "@repo/testing-config/src/utils/payload-config";
import { createDbString } from "@repo/testing-config/src/utils/db";

// Mock Stripe API
vi.mock("@repo/shared-utils", async () => {
  const actual = await vi.importActual("@repo/shared-utils");
  return {
    ...actual,
    stripe: {
      subscriptions: {
        retrieve: vi.fn().mockImplementation((id: string) => {
          // Return mock subscription data based on ID
          const now = Math.floor(Date.now() / 1000);
          return Promise.resolve({
            id,
            status: "active",
            current_period_start: now,
            current_period_end: now + 30 * 24 * 60 * 60,
            cancel_at: null,
            items: {
              data: [
                {
                  quantity: 1,
                },
              ],
            },
          });
        }),
      },
      products: {
        retrieve: vi.fn().mockImplementation((id: string) => {
          return Promise.resolve({
            id,
            name: "Test Product",
            active: true,
          });
        }),
      },
      customers: {
        list: vi.fn().mockResolvedValue({ data: [] }),
        create: vi.fn().mockResolvedValue({ id: "cus_test123" }),
      },
    },
  };
});

import { subscriptionCreated } from "../src/webhooks/subscription-created";
import { subscriptionUpdated } from "../src/webhooks/subscription-updated";
import { subscriptionCanceled } from "../src/webhooks/subscription-canceled";
import { subscriptionPaused } from "../src/webhooks/subscription-paused";
import { subscriptionResumed } from "../src/webhooks/subscription-resumed";
import { productUpdated } from "../src/webhooks/product-updated";

import { User, Plan } from "@repo/shared-types";

const TEST_TIMEOUT = 30000; // 30 seconds

let payload: Payload;
let testUser: User;
let testPlan: Plan;

// Helper function to create a mock Stripe subscription event
const createMockSubscriptionEvent = (
  subscriptionId: string,
  customerId: string,
  productId: string,
  status: Stripe.Subscription.Status = "active",
  metadata: Record<string, string> = {}
): Parameters<typeof subscriptionCreated>[0] => {
  const now = Math.floor(Date.now() / 1000);
  const mockSubscription: Stripe.Subscription = {
    id: subscriptionId,
    object: "subscription",
    customer: customerId,
    status,
    current_period_start: now,
    current_period_end: now + 30 * 24 * 60 * 60, // 30 days from now
    cancel_at: null,
    cancel_at_period_end: false,
    canceled_at: null,
    created: now,
    metadata,
    items: {
      object: "list",
      data: [
        {
          id: "si_test",
          object: "subscription_item",
          plan: {
            id: "plan_test",
            object: "plan",
            product: productId,
            active: true,
            amount: 1000,
            currency: "usd",
            interval: "month",
            interval_count: 1,
            created: now,
          } as Stripe.Plan,
          quantity: 1,
        },
      ],
      has_more: false,
      url: "",
    },
  } as Stripe.Subscription;

  return {
    event: {
      data: {
        object: mockSubscription,
      },
    },
    payload,
    config: {} as any,
    req: {} as any,
    stripe: {} as any,
  } as Parameters<typeof subscriptionCreated>[0];
};

// Helper function to create a mock Stripe product event
const createMockProductEvent = (
  productId: string
): Parameters<typeof productUpdated>[0] => {
  const mockProduct: Stripe.Product = {
    id: productId,
    object: "product",
    active: true,
    name: "Test Plan",
    created: Math.floor(Date.now() / 1000),
    description: "Test Plan Description",
    metadata: {},
  } as Stripe.Product;

  return {
    event: {
      data: {
        object: mockProduct,
      },
    },
    payload,
    config: {} as any,
    req: {} as any,
    stripe: {} as any,
  } as Parameters<typeof productUpdated>[0];
};

describe("Subscription Webhooks", () => {
  beforeAll(async () => {
    if (!process.env.DATABASE_URI) {
      const dbString = await createDbString();
      config.db = setDbString(dbString);
    }

    const builtConfig = await buildConfig(config);
    payload = await getPayload({ config: builtConfig });

    // Create test user
    testUser = (await payload.create({
      collection: "users",
      data: {
        email: "webhook-test@example.com",
        password: "password",
        stripeCustomerId: "cus_test123",
      },
    })) as User;

    // Create test plan
    testPlan = (await payload.create({
      collection: "plans",
      data: {
        name: "Test Plan",
        stripeProductId: "prod_test123",
        price: 1000,
        currency: "usd",
        interval: "month",
      },
    })) as Plan;
  }, TEST_TIMEOUT);

  beforeEach(async () => {
    // Clean up subscriptions before each test
    await payload.delete({
      collection: "subscriptions",
      where: {
        id: {
          exists: true,
        },
      },
    });
  });

  afterEach(async () => {
    // Clean up bookings after each test
    await payload.delete({
      collection: "bookings",
      where: {
        id: {
          exists: true,
        },
      },
    });

    // Clean up lessons after each test
    await payload.delete({
      collection: "lessons",
      where: {
        id: {
          exists: true,
        },
      },
    });

    // Clean up class-options after each test
    await payload.delete({
      collection: "class-options",
      where: {
        id: {
          exists: true,
        },
      },
    });

    // Clean up subscriptions after each test
    await payload.delete({
      collection: "subscriptions",
      where: {
        id: {
          exists: true,
        },
      },
    });
  });

  describe("subscriptionCreated", () => {
    it("should create a subscription when webhook is received", async () => {
      const mockEvent = createMockSubscriptionEvent(
        "sub_test123",
        testUser.stripeCustomerId!,
        testPlan.stripeProductId!
      );

      await subscriptionCreated(mockEvent);

      const subscriptions = await payload.find({
        collection: "subscriptions",
        where: {
          stripeSubscriptionId: { equals: "sub_test123" },
        },
        depth: 0, // Get IDs instead of populated objects
      });

      expect(subscriptions.totalDocs).toBe(1);
      const subscription = subscriptions.docs[0];
      const userId = typeof subscription?.user === "object" ? subscription.user.id : subscription?.user;
      const planId = typeof subscription?.plan === "object" ? subscription.plan.id : subscription?.plan;
      expect(userId).toBe(testUser.id);
      expect(planId).toBe(testPlan.id);
      expect(subscriptions.docs[0]?.status).toBe("active");
      expect(subscriptions.docs[0]?.stripeSubscriptionId).toBe("sub_test123");
    });

    it("should skip if user is not found", async () => {
      const mockEvent = createMockSubscriptionEvent(
        "sub_test456",
        "cus_nonexistent",
        testPlan.stripeProductId!
      );

      await subscriptionCreated(mockEvent);

      const subscriptions = await payload.find({
        collection: "subscriptions",
        where: {
          stripeSubscriptionId: { equals: "sub_test456" },
        },
      });

      expect(subscriptions.totalDocs).toBe(0);
    });

    it("should throw error if plan is not found", async () => {
      const mockEvent = createMockSubscriptionEvent(
        "sub_test789",
        testUser.stripeCustomerId!,
        "prod_nonexistent"
      );

      await expect(subscriptionCreated(mockEvent)).rejects.toThrow(
        "Plan not found"
      );
    });

    it("should create booking when lessonId is provided in metadata", async () => {
      // Create a class option and lesson for booking
      const classOption = await payload.create({
        collection: "class-options",
        data: {
          name: "Test Class",
          places: 10,
          description: "Test",
        },
      });

      const lesson = await payload.create({
        collection: "lessons",
        data: {
          date: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
          startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
          endTime: new Date(Date.now() + 25 * 60 * 60 * 1000),
          classOption: classOption.id,
          location: "Test Location",
        },
      });

      const mockEvent = createMockSubscriptionEvent(
        "sub_with_booking",
        testUser.stripeCustomerId!,
        testPlan.stripeProductId!,
        "active",
        { lessonId: String(lesson.id) }
      );

      await subscriptionCreated(mockEvent);

      const bookings = await payload.find({
        collection: "bookings",
        where: {
          user: { equals: testUser.id },
          lesson: { equals: lesson.id },
        },
      });

      expect(bookings.totalDocs).toBe(1);
      expect(bookings.docs[0]?.status).toBe("confirmed");
    });

    it("should update existing booking when lessonId is provided", async () => {
      // Create a class option and lesson
      const classOption = await payload.create({
        collection: "class-options",
        data: {
          name: "Test Class",
          places: 10,
          description: "Test",
        },
      });

      const lesson = await payload.create({
        collection: "lessons",
        data: {
          date: new Date(Date.now() + 24 * 60 * 60 * 1000),
          startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
          endTime: new Date(Date.now() + 25 * 60 * 60 * 1000),
          classOption: classOption.id,
          location: "Test Location",
        },
      });

      // Create an existing booking
      const existingBooking = await payload.create({
        collection: "bookings",
        data: {
          user: testUser.id,
          lesson: lesson.id,
          status: "pending",
        },
      });

      const mockEvent = createMockSubscriptionEvent(
        "sub_update_booking",
        testUser.stripeCustomerId!,
        testPlan.stripeProductId!,
        "active",
        { lessonId: String(lesson.id) }
      );

      await subscriptionCreated(mockEvent);

      const updatedBooking = await payload.findByID({
        collection: "bookings",
        id: existingBooking.id,
      });

      expect(updatedBooking.status).toBe("confirmed");
    });
  });

  describe("subscriptionUpdated", () => {
    it("should update subscription status and dates", async () => {
      // Create an existing subscription
      const existingSubscription = await payload.create({
        collection: "subscriptions",
        data: {
          user: testUser.id,
          plan: testPlan.id,
          status: "trialing",
          stripeSubscriptionId: "sub_update_test",
        },
      });

      const now = Math.floor(Date.now() / 1000);
      const mockEvent = createMockSubscriptionEvent(
        "sub_update_test",
        testUser.stripeCustomerId!,
        testPlan.stripeProductId!,
        "active"
      );
      mockEvent.event.data.object.current_period_start = now;
      mockEvent.event.data.object.current_period_end = now + 60 * 24 * 60 * 60;
      mockEvent.event.data.object.cancel_at = now + 30 * 24 * 60 * 60;

      await subscriptionUpdated(mockEvent);

      const updated = await payload.findByID({
        collection: "subscriptions",
        id: existingSubscription.id,
      });

      expect(updated.status).toBe("active");
      expect(updated.startDate).toBe(
        new Date(now * 1000).toISOString()
      );
      expect(updated.endDate).toBe(
        new Date((now + 60 * 24 * 60 * 60) * 1000).toISOString()
      );
      expect(updated.cancelAt).toBe(
        new Date((now + 30 * 24 * 60 * 60) * 1000).toISOString()
      );
    });

    it("should get dates from subscription items when not on subscription object", async () => {
      // Create an existing subscription
      const existingSubscription = await payload.create({
        collection: "subscriptions",
        data: {
          user: testUser.id,
          plan: testPlan.id,
          status: "trialing",
          stripeSubscriptionId: "sub_items_dates_test",
        },
      });

      const now = Math.floor(Date.now() / 1000);
      const mockEvent = createMockSubscriptionEvent(
        "sub_items_dates_test",
        testUser.stripeCustomerId!,
        testPlan.stripeProductId!,
        "active"
      );
      
      // Remove dates from subscription object (simulating newer Stripe API behavior)
      delete (mockEvent.event.data.object as any).current_period_start;
      delete (mockEvent.event.data.object as any).current_period_end;
      
      // Add dates to subscription items instead
      const itemStart = now + 10;
      const itemEnd = now + 60 * 24 * 60 * 60 + 10;
      (mockEvent.event.data.object.items.data[0] as any).current_period_start = itemStart;
      (mockEvent.event.data.object.items.data[0] as any).current_period_end = itemEnd;
      
      mockEvent.event.data.object.cancel_at = now + 30 * 24 * 60 * 60;

      await subscriptionUpdated(mockEvent);

      const updated = await payload.findByID({
        collection: "subscriptions",
        id: existingSubscription.id,
      });

      expect(updated.status).toBe("active");
      expect(updated.startDate).toBe(
        new Date(itemStart * 1000).toISOString()
      );
      expect(updated.endDate).toBe(
        new Date(itemEnd * 1000).toISOString()
      );
      expect(updated.cancelAt).toBe(
        new Date((now + 30 * 24 * 60 * 60) * 1000).toISOString()
      );
    });

    it("should prefer subscription object dates over item dates when both exist", async () => {
      // Create an existing subscription
      const existingSubscription = await payload.create({
        collection: "subscriptions",
        data: {
          user: testUser.id,
          plan: testPlan.id,
          status: "trialing",
          stripeSubscriptionId: "sub_prefer_sub_dates",
        },
      });

      const now = Math.floor(Date.now() / 1000);
      const mockEvent = createMockSubscriptionEvent(
        "sub_prefer_sub_dates",
        testUser.stripeCustomerId!,
        testPlan.stripeProductId!,
        "active"
      );
      
      // Set dates on subscription object (should take precedence)
      const subStart = now;
      const subEnd = now + 60 * 24 * 60 * 60;
      mockEvent.event.data.object.current_period_start = subStart;
      mockEvent.event.data.object.current_period_end = subEnd;
      
      // Also set different dates on items (should be ignored)
      const itemStart = now + 100;
      const itemEnd = now + 100 * 24 * 60 * 60;
      (mockEvent.event.data.object.items.data[0] as any).current_period_start = itemStart;
      (mockEvent.event.data.object.items.data[0] as any).current_period_end = itemEnd;

      await subscriptionUpdated(mockEvent);

      const updated = await payload.findByID({
        collection: "subscriptions",
        id: existingSubscription.id,
      });

      expect(updated.status).toBe("active");
      // Should use subscription object dates, not item dates
      expect(updated.startDate).toBe(
        new Date(subStart * 1000).toISOString()
      );
      expect(updated.endDate).toBe(
        new Date(subEnd * 1000).toISOString()
      );
    });

    it("should handle missing dates gracefully", async () => {
      // Create an existing subscription
      const existingSubscription = await payload.create({
        collection: "subscriptions",
        data: {
          user: testUser.id,
          plan: testPlan.id,
          status: "active",
          stripeSubscriptionId: "sub_no_dates",
          startDate: new Date().toISOString(),
          endDate: new Date().toISOString(),
        },
      });

      const mockEvent = createMockSubscriptionEvent(
        "sub_no_dates",
        testUser.stripeCustomerId!,
        testPlan.stripeProductId!,
        "active"
      );
      
      // Remove dates from both subscription object and items
      delete (mockEvent.event.data.object as any).current_period_start;
      delete (mockEvent.event.data.object as any).current_period_end;
      delete (mockEvent.event.data.object.items.data[0] as any).current_period_start;
      delete (mockEvent.event.data.object.items.data[0] as any).current_period_end;

      // Should not throw, just skip updating dates
      await subscriptionUpdated(mockEvent);

      const updated = await payload.findByID({
        collection: "subscriptions",
        id: existingSubscription.id,
      });

      expect(updated.status).toBe("active");
      // Dates should remain unchanged (undefined means field is not updated)
      expect(updated.startDate).toBeDefined();
      expect(updated.endDate).toBeDefined();
    });

    it("should update plan when plan changes", async () => {
      const newPlan = await payload.create({
        collection: "plans",
        data: {
          name: "New Plan",
          stripeProductId: "prod_new123",
          price: 2000,
          currency: "usd",
          interval: "month",
        },
      });

      const existingSubscription = await payload.create({
        collection: "subscriptions",
        data: {
          user: testUser.id,
          plan: testPlan.id,
          status: "active",
          stripeSubscriptionId: "sub_plan_change",
        },
      });

      const mockEvent = createMockSubscriptionEvent(
        "sub_plan_change",
        testUser.stripeCustomerId!,
        newPlan.stripeProductId!,
        "active"
      );

      await subscriptionUpdated(mockEvent);

      const updated = await payload.findByID({
        collection: "subscriptions",
        id: existingSubscription.id,
        depth: 0, // Get IDs instead of populated objects
      });

      const updatedPlanId = typeof updated.plan === "object" ? updated.plan.id : updated.plan;
      expect(updatedPlanId).toBe(newPlan.id);
    });

    it("should support both camelCase and snake_case metadata", async () => {
      const classOption = await payload.create({
        collection: "class-options",
        data: {
          name: "Test Class",
          places: 10,
          description: "Test",
        },
      });

      const lesson = await payload.create({
        collection: "lessons",
        data: {
          date: new Date(Date.now() + 24 * 60 * 60 * 1000),
          startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
          endTime: new Date(Date.now() + 25 * 60 * 60 * 1000),
          classOption: classOption.id,
          location: "Test Location",
        },
      });

      const existingSubscription = await payload.create({
        collection: "subscriptions",
        data: {
          user: testUser.id,
          plan: testPlan.id,
          status: "active",
          stripeSubscriptionId: "sub_metadata_test",
        },
      });

      // Test camelCase
      const mockEventCamel = createMockSubscriptionEvent(
        "sub_metadata_test",
        testUser.stripeCustomerId!,
        testPlan.stripeProductId!,
        "active",
        { lessonId: String(lesson.id) }
      );

      await subscriptionUpdated(mockEventCamel);

      let bookings = await payload.find({
        collection: "bookings",
        where: {
          user: { equals: testUser.id },
          lesson: { equals: lesson.id },
        },
      });

      expect(bookings.totalDocs).toBe(1);

      // Clean up and test snake_case
      await payload.delete({
        collection: "bookings",
        where: {
          id: { equals: bookings.docs[0]!.id },
        },
      });

      const mockEventSnake = createMockSubscriptionEvent(
        "sub_metadata_test",
        testUser.stripeCustomerId!,
        testPlan.stripeProductId!,
        "active",
        { lesson_id: String(lesson.id) }
      );

      await subscriptionUpdated(mockEventSnake);

      bookings = await payload.find({
        collection: "bookings",
        where: {
          user: { equals: testUser.id },
          lesson: { equals: lesson.id },
        },
      });

      expect(bookings.totalDocs).toBe(1);
    });

    it("should skip if user is not found", async () => {
      const mockEvent = createMockSubscriptionEvent(
        "sub_notfound",
        "cus_nonexistent",
        testPlan.stripeProductId!
      );

      await subscriptionUpdated(mockEvent);

      // Should not throw, just skip
      expect(true).toBe(true);
    });

    it("should throw error if subscription is not found", async () => {
      const mockEvent = createMockSubscriptionEvent(
        "sub_nonexistent",
        testUser.stripeCustomerId!,
        testPlan.stripeProductId!
      );

      await expect(subscriptionUpdated(mockEvent)).rejects.toThrow(
        "Subscription not found"
      );
    });
  });

  describe("subscriptionCanceled", () => {
    it("should update subscription status to canceled", async () => {
      const existingSubscription = await payload.create({
        collection: "subscriptions",
        data: {
          user: testUser.id,
          plan: testPlan.id,
          status: "active",
          stripeSubscriptionId: "sub_cancel_test",
        },
      });

      const now = Math.floor(Date.now() / 1000);
      const mockEvent = createMockSubscriptionEvent(
        "sub_cancel_test",
        testUser.stripeCustomerId!,
        testPlan.stripeProductId!,
        "canceled"
      );
      mockEvent.event.data.object.cancel_at = now;

      await subscriptionCanceled(mockEvent);

      const updated = await payload.findByID({
        collection: "subscriptions",
        id: existingSubscription.id,
      });

      expect(updated.status).toBe("canceled");
      expect(updated.cancelAt).toBeDefined();
    });

    it("should cancel related bookings when planId is provided", async () => {
      const classOption = await payload.create({
        collection: "class-options",
        data: {
          name: "Test Class",
          places: 10,
          description: "Test",
          paymentMethods: {
            allowedPlans: [testPlan.id],
          },
        },
      });

      const futureDate = new Date(Date.now() + 48 * 60 * 60 * 1000); // 2 days from now
      const lesson = await payload.create({
        collection: "lessons",
        data: {
          date: futureDate,
          startTime: futureDate,
          endTime: new Date(futureDate.getTime() + 60 * 60 * 1000),
          classOption: classOption.id,
          location: "Test Location",
        },
      });

      const existingSubscription = await payload.create({
        collection: "subscriptions",
        data: {
          user: testUser.id,
          plan: testPlan.id,
          status: "active",
          stripeSubscriptionId: "sub_cancel_bookings",
        },
      });

      const booking = await payload.create({
        collection: "bookings",
        data: {
          user: testUser.id,
          lesson: lesson.id,
          status: "confirmed",
        },
      });

      const mockEvent = createMockSubscriptionEvent(
        "sub_cancel_bookings",
        testUser.stripeCustomerId!,
        testPlan.stripeProductId!,
        "canceled"
      );

      await subscriptionCanceled(mockEvent);

      const updatedBooking = await payload.findByID({
        collection: "bookings",
        id: booking.id,
      });

      expect(updatedBooking.status).toBe("cancelled");
    });

    it("should skip if user is not found", async () => {
      const mockEvent = createMockSubscriptionEvent(
        "sub_cancel_notfound",
        "cus_nonexistent",
        testPlan.stripeProductId!,
        "canceled"
      );

      await subscriptionCanceled(mockEvent);

      // Should not throw, just skip
      expect(true).toBe(true);
    });

    it("should throw error if subscription is not found", async () => {
      const mockEvent = createMockSubscriptionEvent(
        "sub_cancel_nonexistent",
        testUser.stripeCustomerId!,
        testPlan.stripeProductId!,
        "canceled"
      );

      await expect(subscriptionCanceled(mockEvent)).rejects.toThrow(
        "Subscription not found"
      );
    });
  });

  describe("subscriptionPaused", () => {
    it("should update subscription status to paused", async () => {
      const existingSubscription = await payload.create({
        collection: "subscriptions",
        data: {
          user: testUser.id,
          plan: testPlan.id,
          status: "active",
          stripeSubscriptionId: "sub_pause_test",
        },
      });

      const now = Math.floor(Date.now() / 1000);
      const mockEvent = createMockSubscriptionEvent(
        "sub_pause_test",
        testUser.stripeCustomerId!,
        testPlan.stripeProductId!,
        "paused"
      );
      mockEvent.event.data.object.current_period_end = now + 30 * 24 * 60 * 60;
      mockEvent.event.data.object.cancel_at = now + 15 * 24 * 60 * 60;

      await subscriptionPaused(mockEvent);

      const updated = await payload.findByID({
        collection: "subscriptions",
        id: existingSubscription.id,
      });

      expect(updated.status).toBe("paused");
      expect(updated.endDate).toBe(
        new Date((now + 30 * 24 * 60 * 60) * 1000).toISOString()
      );
    });

    it("should skip if user is not found", async () => {
      const mockEvent = createMockSubscriptionEvent(
        "sub_pause_notfound",
        "cus_nonexistent",
        testPlan.stripeProductId!,
        "paused"
      );

      await subscriptionPaused(mockEvent);

      // Should not throw, just skip
      expect(true).toBe(true);
    });

    it("should throw error if subscription is not found", async () => {
      const mockEvent = createMockSubscriptionEvent(
        "sub_pause_nonexistent",
        testUser.stripeCustomerId!,
        testPlan.stripeProductId!,
        "paused"
      );

      await expect(subscriptionPaused(mockEvent)).rejects.toThrow(
        "Subscription not found"
      );
    });
  });

  describe("subscriptionResumed", () => {
    it("should update subscription status when resumed", async () => {
      const existingSubscription = await payload.create({
        collection: "subscriptions",
        data: {
          user: testUser.id,
          plan: testPlan.id,
          status: "paused",
          stripeSubscriptionId: "sub_resume_test",
        },
      });

      const now = Math.floor(Date.now() / 1000);
      const mockEvent = createMockSubscriptionEvent(
        "sub_resume_test",
        testUser.stripeCustomerId!,
        testPlan.stripeProductId!,
        "active"
      );
      mockEvent.event.data.object.current_period_start = now;
      mockEvent.event.data.object.current_period_end = now + 30 * 24 * 60 * 60;
      mockEvent.event.data.object.cancel_at = null;

      await subscriptionResumed(mockEvent);

      const updated = await payload.findByID({
        collection: "subscriptions",
        id: existingSubscription.id,
      });

      expect(updated.status).toBe("active");
      expect(updated.startDate).toBe(
        new Date(now * 1000).toISOString()
      );
      expect(updated.endDate).toBe(
        new Date((now + 30 * 24 * 60 * 60) * 1000).toISOString()
      );
    });

    it("should skip if user is not found", async () => {
      const mockEvent = createMockSubscriptionEvent(
        "sub_resume_notfound",
        "cus_nonexistent",
        testPlan.stripeProductId!,
        "active"
      );

      await subscriptionResumed(mockEvent);

      // Should not throw, just skip
      expect(true).toBe(true);
    });

    it("should throw error if subscription is not found", async () => {
      const mockEvent = createMockSubscriptionEvent(
        "sub_resume_nonexistent",
        testUser.stripeCustomerId!,
        testPlan.stripeProductId!,
        "active"
      );

      await expect(subscriptionResumed(mockEvent)).rejects.toThrow(
        "Subscription not found"
      );
    });
  });

  describe("productUpdated", () => {
    it("should trigger plan update when product is updated", async () => {
      const mockEvent = createMockProductEvent(testPlan.stripeProductId!);

      await productUpdated(mockEvent);

      // The webhook triggers the beforeChange hook which syncs data from Stripe
      // We can't easily test the Stripe API call, but we can verify it doesn't throw
      expect(true).toBe(true);
    });

    it("should skip if plan is not found", async () => {
      const mockEvent = createMockProductEvent("prod_nonexistent");

      await productUpdated(mockEvent);

      // Should not throw, just skip
      expect(true).toBe(true);
    });
  });
});

