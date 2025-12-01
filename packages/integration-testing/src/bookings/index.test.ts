/* eslint-disable no-console */
/**
 * Here are your integration tests for the plugin.
 * They don't require running your Next.js so they are fast
 * Yet they still can test the Local API and custom endpoints using NextRESTClient helper.
 */

import type { Payload } from "payload";

import { beforeAll, afterAll, describe, expect, it } from "vitest";

import { getPayload } from "payload";

import { NextRESTClient } from "@repo/testing-config/src/helpers/NextRESTClient";

import { buildConfig } from "payload";

import { config } from "./config";

import { createDbString } from "@repo/testing-config/src/utils/db";

import { setDbString } from "@repo/testing-config/src/utils/payload-config";
import { DropIn, User } from "@repo/shared-types";

import { createLesson, getSubscriptionStartDate } from "./lesson-helpers";

let payload: Payload;
let restClient: NextRESTClient;
let user: any;

const TEST_TIMEOUT = 300000; // 15 seconds

describe("Booking tests", () => {
  beforeAll(async () => {
    if (!process.env.DATABASE_URI) {
      const dbString = await createDbString();

      config.db = setDbString(dbString);
    }

    const builtConfig = await buildConfig(config);

    payload = await getPayload({ config: builtConfig });
    restClient = new NextRESTClient(builtConfig);

    user = (await payload.create({
      collection: "users",
      data: {
        email: "test@test.com",
        password: "test",
        roles: ["admin"], // Explicitly assign admin role
      },
    })) as User;
  }, TEST_TIMEOUT);

  afterAll(async () => {
    if (payload) {
      await (payload.db as any).destroy();
    }
  });

  it(
    "should be authorised to create a booking because user is admin",
    async () => {
      const dropIn = (await payload.create({
        collection: "drop-ins",
        data: {
          name: "Drop In",
          isActive: true,
          price: 10,
          adjustable: false,
          paymentMethods: ["cash"],
        },
      })) as DropIn;

      const classOption = await payload.create({
        collection: "class-options",
        data: {
          name: "Test Class Option 1",
          places: 1,
          description: "Test Class Option 1",
          paymentMethods: {
            allowedDropIn: dropIn.id,
          },
        },
      });

      const lesson = await createLesson(payload, {
        startHoursOffset: 10, // 10 AM
        durationHours: 1,
        classOption: classOption.id,
        location: "Test Location 1",
      });

      const response = await restClient
        .login({
          credentials: {
            email: user.email,
            password: "test",
          },
        })
        .then(() =>
          restClient.POST("/bookings", {
            body: JSON.stringify({
              lesson: lesson.id,
              user: user.id,
              status: "confirmed",
            }),
          })
        );

      expect(response.status).toBe(201);
    },
    TEST_TIMEOUT
  );
  it(
    "should fail to create a booking because user is not admin",
    async () => {
      const user2 = await payload.create({
        collection: "users",
        data: {
          email: "test2@test.com",
          password: "test",
        },
      });
      const dropIn = await payload.create({
        collection: "drop-ins",
        data: {
          name: "Drop In 1",
          description: "Drop In 1",
          price: 10,
          isActive: true,
          paymentMethods: ["cash"],
        },
      });
      const classOption = await payload.create({
        collection: "class-options",
        data: {
          name: "Test Class Option 2",
          places: 1,
          description: "Test Class Option 2",
          paymentMethods: {
            allowedDropIn: dropIn.id,
          },
        },
      });

      const lesson = await createLesson(payload, {
        startHoursOffset: 10, // 10 AM
        durationHours: 1,
        classOption: classOption.id,
        location: "Test Location 2",
      });

      const response = await restClient
        .login({
          credentials: {
            email: user2.email,
            password: "test",
          },
        })
        .then(() =>
          restClient.POST("/bookings", {
            body: JSON.stringify({
              lesson: lesson.id,
              user: user2.id,
              status: "confirmed",
            }),
          })
        );

      expect(response.status).toBe(403);
    },
    TEST_TIMEOUT
  );
  it(
    "should create a booking because class option has no payment methods",
    async () => {
      const user2 = await payload.create({
        collection: "users",
        data: {
          email: "test2543@test.com",
          password: "test",
        },
      });
      const classOption = await payload.create({
        collection: "class-options",
        data: {
          name: "Test Class Option 3",
          places: 1,
          description: "Test Class Option 3",
        },
      });

      const lesson = await createLesson(payload, {
        startHoursOffset: 9, // 9 AM
        durationHours: 1,
        classOption: classOption.id,
        location: "Test Location 3",
      });

      const response = await restClient
        .login({
          credentials: {
            email: user2.email,
            password: "test",
          },
        })
        .then(() =>
          restClient.POST("/bookings", {
            body: JSON.stringify({
              lesson: lesson.id,
              user: user2.id,
              status: "confirmed",
            }),
          })
        );

      if (response.status !== 201) {
        const errorData = await response.json();
        console.log("Error response:", JSON.stringify(errorData, null, 2));
      }

      expect(response.status).toBe(201);
    },
    TEST_TIMEOUT
  );
  it(
    "it should fail to create a booking because lesson has a drop in payment method",
    async () => {
      const user2 = await payload.create({
        collection: "users",
        data: {
          email: "test5432@test.com",
          password: "test",
        },
      });

      const dropIn = await payload.create({
        collection: "drop-ins",
        data: {
          name: "Drop In 2",
          description: "Drop In 2",
          price: 10,
          isActive: true,
          paymentMethods: ["cash"],
        },
      });

      const classOption = await payload.create({
        collection: "class-options",
        data: {
          name: "Test Class Option 4",
          places: 1,
          description: "Test Class Option 4",
          paymentMethods: {
            allowedDropIn: dropIn.id,
          },
        },
      });

      const lesson = await createLesson(payload, {
        startHoursOffset: 10, // 10 AM
        durationHours: 1,
        classOption: classOption.id,
        location: "Test Location 4",
      });

      const response = await restClient
        .login({
          credentials: {
            email: user2.email,
            password: "test",
          },
        })
        .then(() =>
          restClient.POST("/bookings", {
            body: JSON.stringify({
              lesson: lesson.id,
              user: user2.id,
              status: "confirmed",
            }),
          })
        );

      expect(response.status).toBe(403);
    },
    TEST_TIMEOUT
  );
  it(
    "should fail to create a booking because user is not member of a subscription",
    async () => {
      const user3 = await payload.create({
        collection: "users",
        data: {
          email: "test6@test.com",
          password: "test",
        },
      });

      const plan = await payload.create({
        collection: "plans",
        data: {
          name: "Test Plan",
          priceInformation: {
            price: 10,
            interval: "month",
            intervalCount: 1,
          },
          sessionsInformation: {
            sessions: 1,
            interval: "month",
            intervalCount: 1,
          },
        },
      });

      const classOption = await payload.create({
        collection: "class-options",
        data: {
          name: "Test Class Option 4543",
          places: 1,
          description: "Test Class Option 4",
          paymentMethods: {
            allowedPlans: [plan.id],
          },
        },
      });

      const lesson = await createLesson(payload, {
        startHoursOffset: 10, // 10 AM
        durationHours: 1,
        classOption: classOption.id,
        location: "Test Location 5",
      });

      const response = await restClient
        .login({
          credentials: {
            email: user3.email,
            password: "test",
          },
        })
        .then(() =>
          restClient.POST("/bookings", {
            body: JSON.stringify({
              lesson: lesson.id,
              user: user3.id,
              status: "confirmed",
            }),
          })
        );

      expect(response.status).toBe(403);
    },
    TEST_TIMEOUT
  );
  it(
    "should create a booking because user is member of a subscription",
    async () => {
      const user3 = await payload.create({
        collection: "users",
        data: {
          email: "test654@test.com",
          password: "test",
        },
      });

      const plan = await payload.create({
        collection: "plans",
        data: {
          name: "Test Plan",
          priceInformation: {
            price: 10,
            interval: "month",
            intervalCount: 1,
          },
          sessionsInformation: {
            sessions: 1,
            interval: "month",
            intervalCount: 1,
          },
        },
      });

      const subscription = await payload.create({
        collection: "subscriptions",
        data: {
          user: user3.id,
          plan: plan.id,
          status: "active",
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      const classOption = await payload.create({
        collection: "class-options",
        data: {
          name: "Test Class Option 3432",
          places: 1,
          description: "Test Class Option 3432",
          paymentMethods: {
            allowedPlans: [plan.id],
          },
        },
      });

      const lesson = await createLesson(payload, {
        startHoursOffset: 10, // 10 AM
        durationHours: 1,
        classOption: classOption.id,
        location: "Test Location 6",
      });

      console.log("lesson", lesson);

      const response = await restClient
        .login({
          credentials: {
            email: user3.email,
            password: "test",
          },
        })
        .then(() =>
          restClient.POST("/bookings", {
            body: JSON.stringify({
              lesson: lesson.id,
              user: user3.id,
              status: "confirmed",
            }),
          })
        );

      if (response.status !== 201) {
        const errorData = await response.json();
        console.log(
          "Error response for subscription test:",
          JSON.stringify(errorData, null, 2)
        );
      }

      expect(response.status).toBe(201);
    },
    TEST_TIMEOUT
  );
  it(
    "should fail to create a booking because user has reached subscription limit",
    async () => {
      const user3 = await payload.create({
        collection: "users",
        data: {
          email: "test3@test.com",
          password: "test",
        },
      });

      const plan = await payload.create({
        collection: "plans",
        data: {
          name: "Test Plan",
          priceInformation: {
            price: 10,
            interval: "week",
            intervalCount: 2,
          },
          sessionsInformation: {
            sessions: 3,
            interval: "week",
            intervalCount: 2,
          },
        },
      });

      const subscription = await payload.create({
        collection: "subscriptions",
        data: {
          user: user3.id,
          plan: plan.id,
          status: "active",
          startDate: getSubscriptionStartDate(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      const classOption = await payload.create({
        collection: "class-options",
        data: {
          name: "Test Class Option 14",
          places: 1,
          description: "Test Class Option 4",
          paymentMethods: {
            allowedPlans: [plan.id],
          },
        },
      });

      const baseDate = new Date();
      const lesson1 = await createLesson(payload, {
        baseDate,
        startHoursOffset: 10, // 10 AM
        durationHours: 1,
        classOption: classOption.id,
        location: "Test Location Limit 1",
      });

      const lesson2 = await createLesson(payload, {
        baseDate,
        startHoursOffset: 12, // 12 PM
        durationHours: 1,
        classOption: classOption.id,
        location: "Test Location Limit 2",
      });

      const lesson3 = await createLesson(payload, {
        baseDate,
        startHoursOffset: 14, // 2 PM
        durationHours: 1,
        classOption: classOption.id,
        location: "Test Location Limit 3",
      });

      const lesson4 = await createLesson(payload, {
        baseDate,
        startHoursOffset: 16, // 4 PM
        durationHours: 1,
        classOption: classOption.id,
        location: "Test Location Limit 4",
      });

      const booking1 = await payload.create({
        collection: "bookings",
        data: {
          lesson: lesson1.id,
          user: user3.id,
          status: "confirmed",
        },
      });

      const booking2 = await payload.create({
        collection: "bookings",
        data: {
          lesson: lesson2.id,
          user: user3.id,
          status: "confirmed",
        },
      });

      const booking3 = await payload.create({
        collection: "bookings",
        data: {
          lesson: lesson3.id,
          user: user3.id,
          status: "confirmed",
        },
      });

      const response = await restClient
        .login({
          credentials: {
            email: user3.email,
            password: "test",
          },
        })
        .then(() =>
          restClient.POST("/bookings", {
            body: JSON.stringify({
              lesson: lesson4.id,
              user: user3.id,
              status: "confirmed",
            }),
          })
        );

      expect(response.status).toBe(403);
    },
    TEST_TIMEOUT
  );
  it(
    "should create a booking even though user has multipe bookings users hasnt reached subscription limit becuase one of the bookings is not in the subscription",
    async () => {
      const user3 = await payload.create({
        collection: "users",
        data: {
          email: "test4@test.com",
          password: "test",
        },
      });

      const plan = await payload.create({
        collection: "plans",
        data: {
          name: "Test Plan",
          priceInformation: {
            price: 10,
            interval: "month",
            intervalCount: 1,
          },
          sessionsInformation: {
            sessions: 1,
            interval: "month",
            intervalCount: 1,
          },
        },
      });

      const subscription = await payload.create({
        collection: "subscriptions",
        data: {
          user: user3.id,
          plan: plan.id,
          status: "active",
          startDate: getSubscriptionStartDate(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      const classOptionWithPlan = await payload.create({
        collection: "class-options",
        data: {
          name: "Test Class Option 5",
          places: 1,
          description: "Test Class Option 5",
          paymentMethods: {
            allowedPlans: [plan.id],
          },
        },
      });
      const classOptionWithoutPlan = await payload.create({
        collection: "class-options",
        data: {
          name: "Test Class Option 6",
          places: 1,
          description: "Test Class Option 6",
        },
      });

      const baseDate = new Date();
      const lesson = await createLesson(payload, {
        baseDate,
        startHoursOffset: 10, // 10 AM
        durationHours: 1,
        classOption: classOptionWithPlan.id,
        location: "Test Location A",
      });

      const lesson1 = await createLesson(payload, {
        baseDate,
        startHoursOffset: 12, // 12 PM
        durationHours: 1,
        classOption: classOptionWithoutPlan.id,
        location: "Test Location B",
      });

      const booking = await payload.create({
        collection: "bookings",
        data: {
          lesson: lesson1.id,
          user: user3.id,
          status: "confirmed",
        },
      });

      const response = await restClient
        .login({
          credentials: {
            email: user3.email,
            password: "test",
          },
        })
        .then(() =>
          restClient.POST("/bookings", {
            body: JSON.stringify({
              lesson: lesson.id,
              user: user3.id,
              status: "confirmed",
            }),
          })
        );

      expect(response.status).toBe(201);
    },
    TEST_TIMEOUT
  );
  it(
    "should fail because lesson is after subscription cancel date",
    async () => {
      const user3 = await payload.create({
        collection: "users",
        data: {
          email: "test5@test.com",
          password: "test",
        },
      });

      const plan = await payload.create({
        collection: "plans",
        data: {
          name: "Test Plan",
          priceInformation: {
            price: 10,
            interval: "month",
            intervalCount: 1,
          },
          sessionsInformation: {
            sessions: 1,
            interval: "month",
            intervalCount: 1,
          },
        },
      });

      const subscription = await payload.create({
        collection: "subscriptions",
        data: {
          user: user3.id,
          plan: plan.id,
          status: "active",
          startDate: new Date(),
          cancelAt: new Date(Date.now() + 1 * 60 * 60 * 1000),
        },
      });

      const classOption = await payload.create({
        collection: "class-options",
        data: {
          name: "Test Class Option 7",
          places: 1,
          description: "Test Class Option 7",
          paymentMethods: {
            allowedPlans: [plan.id],
          },
        },
      });

      const lesson = await createLesson(payload, {
        startHoursOffset: 10, // 10 AM
        durationHours: 1,
        classOption: classOption.id,
        location: "Test Location 7",
      });

      const response = await restClient
        .login({
          credentials: {
            email: user3.email,
            password: "test",
          },
        })
        .then(() =>
          restClient.POST("/bookings", {
            body: JSON.stringify({
              lesson: lesson.id,
              user: user3.id,
              status: "confirmed",
            }),
          })
        );

      expect(response.status).toBe(403);
    },
    TEST_TIMEOUT
  );
  it(
    "should succeed to complete bookings because booking are evenly spread out",
    async () => {
      const user3 = await payload.create({
        collection: "users",
        data: {
          email: "test7@test.com",
          password: "test",
        },
      });

      const plan = await payload.create({
        collection: "plans",
        data: {
          name: "Test Plan",
          priceInformation: {
            price: 10,
            interval: "week",
            intervalCount: 1,
          },
          sessionsInformation: {
            sessions: 1,
            interval: "week",
            intervalCount: 1,
          },
        },
      });

      const subscription = await payload.create({
        collection: "subscriptions",
        data: {
          user: user3.id,
          plan: plan.id,
          status: "active",
          startDate: new Date(),
          endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        },
      });

      const classOption = await payload.create({
        collection: "class-options",
        data: {
          name: "Test Class Option 8",
          places: 2,
          description: "Test Class Option 8",
          paymentMethods: {
            allowedPlans: [plan.id],
          },
        },
      });

      // First lesson - current week (32 hours from now, which is tomorrow + 8 hours)
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const lesson1 = await createLesson(payload, {
        baseDate: tomorrow,
        startHoursOffset: 8,
        durationHours: 1,
        classOption: classOption.id,
        location: "Test Location",
      });

      const booking1 = await payload.create({
        collection: "bookings",
        data: {
          lesson: lesson1.id,
          user: user3.id,
          status: "confirmed",
        },
      });

      // Second lesson - next week (add 8 days to ensure it's in a different week)
      const nextWeekDate = new Date();
      nextWeekDate.setDate(nextWeekDate.getDate() + 8);
      const lesson2 = await createLesson(payload, {
        baseDate: nextWeekDate,
        startHoursOffset: 10,
        durationHours: 1,
        classOption: classOption.id,
        location: "Test Location",
      });

      const response = await restClient
        .login({
          credentials: {
            email: user3.email,
            password: "test",
          },
        })
        .then(() =>
          restClient.POST("/bookings", {
            body: JSON.stringify({
              lesson: lesson2.id,
              user: user3.id,
              status: "confirmed",
            }),
          })
        );

      expect(response.status).toBe(201);
    },
    TEST_TIMEOUT
  );
  it(
    "should fail because users subscription is not in allowed plans",
    async () => {
      const user3 = await payload.create({
        collection: "users",
        data: {
          email: "test8@test.com",
          password: "test",
        },
      });

      const allowedPlan = await payload.create({
        collection: "plans",
        data: {
          name: "Test Plan",
          priceInformation: {
            price: 10,
            interval: "month",
            intervalCount: 1,
          },
          sessionsInformation: {
            sessions: 1,
            interval: "month",
            intervalCount: 1,
          },
        },
      });

      const disallowedPlan = await payload.create({
        collection: "plans",
        data: {
          name: "Test Plan 2",
          priceInformation: {
            price: 10,
            interval: "month",
            intervalCount: 1,
          },
          sessionsInformation: {
            sessions: 1,
            interval: "month",
            intervalCount: 1,
          },
        },
      });

      const subscription = await payload.create({
        collection: "subscriptions",
        data: {
          user: user3.id,
          plan: disallowedPlan.id,
          status: "active",
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      const classOption = await payload.create({
        collection: "class-options",
        data: {
          name: "Test Class Option 9",
          places: 1,
          description: "Test Class Option 9",
          paymentMethods: {
            allowedPlans: [allowedPlan.id],
          },
        },
      });

      const lesson = await createLesson(payload, {
        startHoursOffset: 10, // 10 AM
        durationHours: 1,
        classOption: classOption.id,
        location: "Test Location 9",
      });

      const response = await restClient
        .login({
          credentials: {
            email: user3.email,
            password: "test",
          },
        })
        .then(() =>
          restClient.POST("/bookings", {
            body: JSON.stringify({
              lesson: lesson.id,
              user: user3.id,
              status: "confirmed",
            }),
          })
        );

      expect(response.status).toBe(403);
    },
    TEST_TIMEOUT
  );
  it(
    "should create a booking because users subscription is in allowed plans",
    async () => {
      const user3 = await payload.create({
        collection: "users",
        data: {
          email: "test32@test.com",
          password: "test",
        },
      });

      const allowedPlan = await payload.create({
        collection: "plans",
        data: {
          name: "Test Plan",
          priceInformation: {
            price: 10,
            interval: "month",
            intervalCount: 1,
          },
          sessionsInformation: {
            sessions: 1,
            interval: "month",
            intervalCount: 1,
          },
        },
      });

      const disallowedPlan = await payload.create({
        collection: "plans",
        data: {
          name: "Test Plan 2",
          priceInformation: {
            price: 10,
            interval: "month",
            intervalCount: 1,
          },
          sessionsInformation: {
            sessions: 1,
            interval: "month",
            intervalCount: 1,
          },
        },
      });

      const subscription = await payload.create({
        collection: "subscriptions",
        data: {
          user: user3.id,
          plan: allowedPlan.id,
          status: "active",
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      const classOption = await payload.create({
        collection: "class-options",
        data: {
          name: "Test Class Option 32",
          places: 1,
          description: "Test Class Option 9",
          paymentMethods: {
            allowedPlans: [allowedPlan.id],
          },
        },
      });

      const lesson = await createLesson(payload, {
        startHoursOffset: 10, // 10 AM
        durationHours: 1,
        classOption: classOption.id,
        location: "Test Location 10",
      });

      const response = await restClient
        .login({
          credentials: {
            email: user3.email,
            password: "test",
          },
        })
        .then(() =>
          restClient.POST("/bookings", {
            body: JSON.stringify({
              lesson: lesson.id,
              user: user3.id,
              status: "confirmed",
            }),
          })
        );

      expect(response.status).toBe(201);
    },
    TEST_TIMEOUT
  );
  it(
    "should fail because user has a subscription that is not active",
    async () => {
      const user3 = await payload.create({
        collection: "users",
        data: {
          email: "test9@test.com",
          password: "test",
        },
      });

      const plan = await payload.create({
        collection: "plans",
        data: {
          name: "Test Plan",
          priceInformation: {
            price: 10,
            interval: "month",
            intervalCount: 1,
          },
          sessionsInformation: {
            sessions: 1,
            interval: "month",
            intervalCount: 1,
          },
        },
      });

      const subscription = await payload.create({
        collection: "subscriptions",
        data: {
          user: user3.id,
          plan: plan.id,
          status: "past_due",
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      const classOption = await payload.create({
        collection: "class-options",
        data: {
          name: "Test Class Option 10",
          places: 1,
          description: "Test Class Option 10",
          paymentMethods: {
            allowedPlans: [plan.id],
          },
        },
      });

      const lesson = await createLesson(payload, {
        startHoursOffset: 10, // 10 AM
        durationHours: 1,
        classOption: classOption.id,
        location: "Test Location 11",
      });

      const response = await restClient
        .login({
          credentials: {
            email: user3.email,
            password: "test",
          },
        })
        .then(() =>
          restClient.POST("/bookings", {
            body: JSON.stringify({
              lesson: lesson.id,
              user: user3.id,
              status: "confirmed",
            }),
          })
        );

      expect(response.status).toBe(403);
    },
    TEST_TIMEOUT
  );
});
