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

import { User } from "@repo/shared-types";

let payload: Payload;
let restClient: NextRESTClient;
let user: User;

const TEST_TIMEOUT = 60000; // 60 seconds
const HOOK_TIMEOUT = 100000; // 100 seconds for setup hooks

describe("Booking tests", () => {
  beforeAll(async () => {
    if (!process.env.DATABASE_URI) {
      console.log("Creating database string");
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
      })) as unknown as User;
  }, HOOK_TIMEOUT);

  afterAll(async () => {
    if (payload) {
      await payload.db.destroy();
    }
  });

  it(
    "should be unauthorized to get the bookings endpoint ",
    async () => {
      const response = await restClient.GET("/bookings");
      expect(response.status).toBe(403);
    },
    TEST_TIMEOUT
  );
  it(
    "should be authorized to create a booking endpoint with user that is not an admin because the lesson has no payment methods",
    async () => {
      const userWithoutPaymentMethods = await payload.create({
        collection: "users",
        data: {
          email: "user@test.com",
          password: "test",
        },
      });
      const classOptionWithoutPaymentMethods = await payload.create({
        collection: "class-options",
        data: {
          name: "Test Class Option 1",
          places: 4,
          description: "Test Class Option",
        },
      });

      const lesson = await payload.create({
        collection: "lessons",
        data: {
          date: new Date(),
          startTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
          endTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
          classOption: classOptionWithoutPaymentMethods.id,
          location: "Test Location",
        },
      });

      const response = await restClient
        .login({
          credentials: {
            email: userWithoutPaymentMethods.email,
            password: "test",
          },
        })
        .then(() =>
          restClient.POST("/bookings", {
            body: JSON.stringify({
              lesson: lesson.id,
              user: userWithoutPaymentMethods.id,
              status: "confirmed",
            }),
          })
        );

      const data = await response.json();

      expect(response.status).toBe(201);
    },
    TEST_TIMEOUT
  );
  it(
    "should be unauthorized to create a booking because lesson is full",
    async () => {
      const user1 = await payload.create({
        collection: "users",
        data: {
          email: "user1@test.com",
          password: "test",
        },
      });

      const user2 = await payload.create({
        collection: "users",
        data: {
          email: "user2@test.com",
          password: "test",
        },
      });

      const classOption = await payload.create({
        collection: "class-options",
        data: {
          name: "Test Class Option 2",
          places: 1,
          description: "Test Class Option 2",
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

      const booking1 = await payload.create({
        collection: "bookings",
        data: {
          lesson: lesson.id,
          user: user1.id,
          status: "confirmed",
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
    "should be able to create a booking",
    async () => {
      const classOption = await payload.create({
        collection: "class-options",
        data: {
          name: "Test Class Option 3",
          places: 1,
          description: "Test Class Option 3",
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

      const user = await payload.create({
        collection: "users",
        data: {
          email: "user3@test.com",
          password: "test",
        },
      });

      const response = await restClient.POST("/bookings", {
        body: JSON.stringify({
          lesson: lesson.id,
          user: user.id,
          status: "confirmed",
        }),
      });

      expect(response.status).toBe(201);
    },
    TEST_TIMEOUT
  );
  it(
    "should be able to update a booking",
    async () => {
      const classOption = await payload.create({
        collection: "class-options",
        data: {
          name: "Test Class Option 4",
          places: 1,
          description: "Test Class Option 4",
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

      const user = await payload.create({
        collection: "users",
        data: {
          email: "user4@test.com",
          password: "test",
        },
      });

      const booking = await payload.create({
        collection: "bookings",
        data: {
          lesson: lesson.id,
          user: user.id,
          status: "confirmed",
        },
      });

      const response = await restClient.PATCH(`/bookings/${booking.id}`, {
        body: JSON.stringify({
          status: "cancelled",
        }),
      });

      expect(response.status).toBe(200);
    },
    TEST_TIMEOUT
  );
});
