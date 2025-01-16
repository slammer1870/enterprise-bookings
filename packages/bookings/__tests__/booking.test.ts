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

let payload: Payload;
let restClient: NextRESTClient;

describe("Booking tests", () => {
  beforeAll(async () => {
    if (!process.env.DATABASE_URI) {
      const dbString = await createDbString();

      config.db = setDbString(dbString);
    }

    const builtConfig = await buildConfig(config);

    payload = await getPayload({ config: builtConfig });
    restClient = new NextRESTClient(builtConfig);
  });

  it("should be unauthorized to get the bookings endpoint without user", async () => {
    const response = await restClient.GET("/bookings");
    expect(response.status).toBe(403);
  });

  it("should be unauthorized to get the bookings endpoint with user that is not admin or member", async () => {
    const user = await payload.create({
      collection: "users",
      data: {
        email: "test@test.com",
        password: "test",
      },
    });

    const classOption = await payload.create({
      collection: "class-options",
      data: {
        name: "Test Class Option",
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

    expect(response.status).toBe(403);
  });
});
