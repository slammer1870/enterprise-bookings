/* eslint-disable no-console */
/**
 * Here are your integration tests for the plugin.
 * They don't require running your Next.js so they are fast
 * Yet they still can test the Local API and custom endpoints using NextRESTClient helper.
 */

import type { Payload } from "payload";

import { beforeAll, afterAll, describe, expect, it } from "vitest";

import { buildConfig, getPayload } from "payload";

import { config } from "./config.js";

import { setDbString } from "@repo/payload-testing/src/utils/payload-config";
import { createDbString } from "@repo/testing-config/src/utils/db";

import { NextRESTClient } from "@repo/payload-testing/src/helpers/NextRESTClient";

import { ClassOption, Lesson } from "@repo/shared-types";

const TEST_TIMEOUT = 30000; // 30 seconds
const HOOK_TIMEOUT = 300000; // 5 minutes for setup hooks (DB + Payload init can be slow under turbo parallelism)

let payload: Payload;
let restClient: NextRESTClient;
let classOption: ClassOption;

describe("Lesson tests", () => {
  beforeAll(async () => {
    if (!process.env.DATABASE_URI) {
      const dbString = await createDbString();

      config.db = setDbString(dbString);
    }

    const builtConfig = await buildConfig(config);

    payload = await getPayload({ config: builtConfig });
    restClient = new NextRESTClient(builtConfig);

    classOption = (await payload.create({
      collection: "class-options",
      data: {
        name: "Test Class Option",
        places: 4,
        description: "Test Class Option",
      },
      })) as ClassOption;
  }, HOOK_TIMEOUT);

  afterAll(async () => {
    if (payload) {
      await payload.db.destroy();
    }
  });

  it(
    "should should get the lessons endpoint",
    async () => {
      const response = await restClient.GET("/lessons");
      expect(response.status).toBe(200);
    },
    TEST_TIMEOUT
  );
  it(
    "should have a booking status of active",
    async () => {
      const now = new Date(); // Get the current date and time
      const tomorrow = new Date(now); // Create a new Date object based on the current date
      tomorrow.setDate(now.getDate() + 1);

      const oneHourLater = new Date(tomorrow); // Create a copy of the current date
      oneHourLater.setHours(oneHourLater.getHours() + 1);

      const lesson = await payload.create({
        collection: "lessons",
        data: {
          date: tomorrow,
          startTime: tomorrow,
          endTime: oneHourLater,
          lockOutTime: 720,
          classOption: classOption.id,
          location: "Test Location",
        },
      });

      const response = await restClient.GET(`/lessons/${lesson.id}`);

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.bookingStatus).toBe("active");
    },
    TEST_TIMEOUT
  );
  it(
    "should have a booking status of closed",
    async () => {
      const lesson = await payload.create({
        collection: "lessons",
        data: {
          date: new Date(),
          startTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
          endTime: new Date(Date.now() - 1 * 60 * 60 * 1000),
          classOption: classOption.id,
          location: "Test Location",
        },
      });

      const response = await restClient.GET(`/lessons/${lesson.id}`);

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.bookingStatus).toBe("closed");
    },
    TEST_TIMEOUT
  );
  it(
    "should have a booking status of booked",
    async () => {
      const user = await payload.create({
        collection: "users",
        data: {
          email: "test@test.com",
          password: "test",
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

      const booking = await payload.create({
        collection: "bookings",
        data: {
          user: user.id,
          lesson: lesson.id,
          status: "confirmed",
        },
      });

      const response = await restClient
        .login({ credentials: { email: "test@test.com", password: "test" } })
        .then(() => restClient.GET(`/lessons/${lesson.id}`));

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.bookingStatus).toBe("booked");
      expect(data.remainingCapacity).toBe(3);
    },
    TEST_TIMEOUT
  );
  it(
    "should have a booking status of waitlist",
    async () => {
      const user1 = await payload.create({
        collection: "users",
        data: {
          email: "waitlis1t@test.com",
          password: "test",
        },
      });

      const user2 = await payload.create({
        collection: "users",
        data: {
          email: "waitlis2t@test.com",
          password: "test",
        },
      });

      const user3 = await payload.create({
        collection: "users",
        data: {
          email: "waitlis3t@test.com",
          password: "test",
        },
      });

      const user4 = await payload.create({
        collection: "users",
        data: {
          email: "waitlis4t@test.com",
          password: "test",
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
          user: user1.id,
          lesson: lesson.id,
          status: "confirmed",
        },
      });
      const booking2 = await payload.create({
        collection: "bookings",
        data: {
          user: user2.id,
          lesson: lesson.id,
          status: "confirmed",
        },
      });
      const booking3 = await payload.create({
        collection: "bookings",
        data: {
          user: user3.id,
          lesson: lesson.id,
          status: "confirmed",
        },
      });
      const booking4 = await payload.create({
        collection: "bookings",
        data: {
          user: user4.id,
          lesson: lesson.id,
          status: "confirmed",
        },
      });

      const response = await restClient.GET(`/lessons/${lesson.id}`);

      const data = (await response.json()) as Lesson;

      expect(response.status).toBe(200);
      expect(data.bookingStatus).toBe("waitlist");
    },
    TEST_TIMEOUT
  );
});
