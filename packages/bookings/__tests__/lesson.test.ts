/* eslint-disable no-console */
/**
 * Here are your integration tests for the plugin.
 * They don't require running your Next.js so they are fast
 * Yet they still can test the Local API and custom endpoints using NextRESTClient helper.
 */

import type { Payload } from "payload";

import { beforeAll, describe, expect, it } from "vitest";

import { buildConfig, getPayload } from "payload";

import { config } from "./config.js";

import { setDbString } from "@repo/testing-config/src/utils/payload-config";
import { createDbString } from "@repo/testing-config/src/utils/db";

import { NextRESTClient } from "@repo/testing-config/src/helpers/NextRESTClient";

import { ClassOption } from "../src/types.js";

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
  });

  it("should should get the lessons endpoint", async () => {
    const response = await restClient.GET("/lessons");
    expect(response.status).toBe(200);
  });
  it("should have a booking status of active", async () => {
    const now = new Date(); // Get the current date and time
    const tomorrow = new Date(now); // Create a new Date object based on the current date
    tomorrow.setDate(now.getDate() + 1);

    const oneHourLater = new Date(tomorrow); // Create a copy of the current date
    oneHourLater.setHours(oneHourLater.getHours() + 1);

    const lesson = await payload.create({
      collection: "lessons",
      data: {
        date: tomorrow,
        start_time: tomorrow,
        end_time: oneHourLater,
        class_option: classOption.id,
        location: "Test Location",
      },
    });

    const response = await restClient.GET(`/lessons/${lesson.id}`);

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.booking_status).toBe("active");
  });
  it("should have a booking status of closed", async () => {
    const lesson = await payload.create({
      collection: "lessons",
      data: {
        date: new Date(),
        start_time: new Date(Date.now() - 2 * 60 * 60 * 1000),
        end_time: new Date(Date.now() - 1 * 60 * 60 * 1000),
        class_option: classOption.id,
        location: "Test Location",
      },
    });

    const response = await restClient.GET(`/lessons/${lesson.id}`);

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.booking_status).toBe("closed");
  });
  it("should have a booking status of booked", async () => {
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
        start_time: new Date(Date.now() + 2 * 60 * 60 * 1000),
        end_time: new Date(Date.now() + 3 * 60 * 60 * 1000),
        class_option: classOption.id,
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
    expect(data.booking_status).toBe("booked");
    expect(data.remaining_capacity).toBe(3);
  });
  it("should have a booking status of waitlist", async () => {
    const user = await payload.create({
      collection: "users",
      data: {
        email: "waitlist@test.com",
        password: "test",
      },
    });

    const lesson = await payload.create({
      collection: "lessons",
      data: {
        date: new Date(),
        start_time: new Date(Date.now() + 2 * 60 * 60 * 1000),
        end_time: new Date(Date.now() + 3 * 60 * 60 * 1000),
        class_option: classOption.id,
        location: "Test Location",
      },
    });

    const booking1 = await payload.create({
      collection: "bookings",
      data: {
        user: user.id,
        lesson: lesson.id,
        status: "confirmed",
      },
    });
    const booking2 = await payload.create({
      collection: "bookings",
      data: {
        user: user.id,
        lesson: lesson.id,
        status: "confirmed",
      },
    });
    const booking3 = await payload.create({
      collection: "bookings",
      data: {
        user: user.id,
        lesson: lesson.id,
        status: "confirmed",
      },
    });
    const booking4 = await payload.create({
      collection: "bookings",
      data: {
        user: user.id,
        lesson: lesson.id,
        status: "confirmed",
      },
    });

    const response = await restClient.GET(`/lessons/${lesson.id}`);

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.booking_status).toBe("waitlist");
  });
});
