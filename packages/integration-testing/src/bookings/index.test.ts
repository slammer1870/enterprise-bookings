/* eslint-disable no-console */
/**
 * Here are your integration tests for the plugin.
 * They don't require running your Next.js so they are fast
 * Yet they still can test the Local API and custom endpoints using NextRESTClient helper.
 */

import type { Payload } from "payload";

import { beforeAll, describe, expect, it } from "vitest";

import { getPayload } from "payload";

import { NextRESTClient } from "@repo/testing-config/src/helpers/NextRESTClient";

import { buildConfig } from "payload";

import { config } from "./config";

import { createDbString } from "@repo/testing-config/src/utils/db";

import { setDbString } from "@repo/testing-config/src/utils/payload-config";
import { DropIn, User } from "@repo/shared-types";

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
      },
    })) as User;
  }, TEST_TIMEOUT);
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
            allowedDropIns: dropIn.id,
          },
        },
      });

      const lesson = await payload.create({
        collection: "lessons",
        data: {
          date: new Date(),
          startTime: new Date(Date.now() + 12 * 60 * 60 * 1000),
          endTime: new Date(Date.now() + 13 * 60 * 60 * 1000),
          classOption: classOption.id,
          location: "Test Location",
        },
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
            allowedDropIns: dropIn.id,
          },
        },
      });

      const lesson = await payload.create({
        collection: "lessons",
        data: {
          date: new Date(),
          startTime: new Date(Date.now() + 12 * 60 * 60 * 1000),
          endTime: new Date(Date.now() + 13 * 60 * 60 * 1000),
          classOption: classOption.id,
          location: "Test Location",
        },
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
    "should create a booking because user is member of a subscription",
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
          price: 10,
          sessions: 1,
          interval: "month",
          intervalCount: 1,
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
          name: "Test Class Option 3",
          places: 1,
          description: "Test Class Option 3",
          paymentMethods: {
            allowedPlans: [plan.id],
          },
        },
      });

      const lesson = await payload.create({
        collection: "lessons",
        data: {
          date: new Date(),
          startTime: new Date(Date.now() + 12 * 60 * 60 * 1000),
          endTime: new Date(Date.now() + 13 * 60 * 60 * 1000),
          classOption: classOption.id,
          location: "Test Location",
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

      console.log("PLAN SUCEED RESPONSE", await response.json());

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
          price: 10,
          sessions: 3,
          interval: "week",
          intervalCount: 2,
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
          name: "Test Class Option 4",
          places: 1,
          description: "Test Class Option 4",
          paymentMethods: {
            allowedPlans: [plan.id],
          },
        },
      });

      const lesson1 = await payload.create({
        collection: "lessons",
        data: {
          date: new Date(),
          startTime: new Date(Date.now() + 12 * 60 * 60 * 1000),
          endTime: new Date(Date.now() + 13 * 60 * 60 * 1000),
          classOption: classOption.id,
          location: "Test Location",
        },
      });

      const lesson2 = await payload.create({
        collection: "lessons",
        data: {
          date: new Date(),
          startTime: new Date(Date.now() + 4 * 60 * 60 * 1000),
          endTime: new Date(Date.now() + 5 * 60 * 60 * 1000),
          classOption: classOption.id,
          location: "Test Location",
        },
      });

      const lesson3 = await payload.create({
        collection: "lessons",
        data: {
          date: new Date(),
          startTime: new Date(Date.now() + 16 * 60 * 60 * 1000),
          endTime: new Date(Date.now() + 17 * 60 * 60 * 1000),
          classOption: classOption.id,
          location: "Test Location",
        },
      });

      const lesson4 = await payload.create({
        collection: "lessons",
        data: {
          date: new Date(),
          startTime: new Date(Date.now() + 18 * 60 * 60 * 1000),
          endTime: new Date(Date.now() + 19 * 60 * 60 * 1000),
          classOption: classOption.id,
          location: "Test Location",
        },
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
          price: 10,
          sessions: 1,
          interval: "month",
          intervalCount: 1,
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

      const lesson = await payload.create({
        collection: "lessons",
        data: {
          date: new Date(),
          startTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
          endTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
          classOption: classOptionWithPlan.id,
          location: "Test Location",
        },
      });

      const lesson1 = await payload.create({
        collection: "lessons",
        data: {
          date: new Date(),
          startTime: new Date(Date.now() + 4 * 60 * 60 * 1000),
          endTime: new Date(Date.now() + 5 * 60 * 60 * 1000),
          classOption: classOptionWithoutPlan.id,
          location: "Test Location",
        },
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
    "should fail because lesson is after subscription end date",
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
          price: 10,
          sessions: 1,
          interval: "month",
          intervalCount: 1,
        },
      });

      const subscription = await payload.create({
        collection: "subscriptions",
        data: {
          user: user3.id,
          plan: plan.id,
          status: "active",
          startDate: new Date(),
          endDate: new Date(Date.now() + 1 * 60 * 60 * 1000),
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

      const lesson = await payload.create({
        collection: "lessons",
        data: {
          date: new Date(),
          startTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
          endTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
          classOption: classOption.id,
          location: "Test Location",
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
          price: 10,
          sessions: 1,
          interval: "week",
          intervalCount: 1,
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

      // First lesson - current week
      const lesson1 = await payload.create({
        collection: "lessons",
        data: {
          date: new Date(Date.now() + 32 * 60 * 60 * 1000),
          startTime: new Date(Date.now() + 32 * 60 * 60 * 1000),
          endTime: new Date(Date.now() + 33 * 60 * 60 * 1000),
          classOption: classOption.id,
          location: "Test Location",
        },
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
      const nextWeekDate = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);
      const lesson2 = await payload.create({
        collection: "lessons",
        data: {
          date: nextWeekDate,
          startTime: nextWeekDate,
          endTime: new Date(nextWeekDate.getTime() + 60 * 60 * 1000), // 1 hour duration
          classOption: classOption.id,
          location: "Test Location",
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
          price: 10,
        },
      });

      const disallowedPlan = await payload.create({
        collection: "plans",
        data: {
          name: "Test Plan 2",
          price: 10,
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

      const lesson = await payload.create({
        collection: "lessons",
        data: {
          date: new Date(),
          startTime: new Date(Date.now() + 12 * 60 * 60 * 1000),
          endTime: new Date(Date.now() + 13 * 60 * 60 * 1000),
          classOption: classOption.id,
          location: "Test Location",
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

      expect(response.status).toBe(403);
    },
    TEST_TIMEOUT
  );
});
