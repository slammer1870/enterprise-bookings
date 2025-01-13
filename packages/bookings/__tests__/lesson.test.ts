/* eslint-disable no-console */
/**
 * Here are your integration tests for the plugin.
 * They don't require running your Next.js so they are fast
 * Yet they still can test the Local API and custom endpoints using NextRESTClient helper.
 */

import type { Payload } from "payload";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import dotenv from "dotenv";
import path from "path";
import { getPayload } from "payload";
import { fileURLToPath } from "url";

import { NextRESTClient } from "./helpers/NextRESTClient.js";

import { PostgreSqlContainer } from "@testcontainers/postgresql";

import { createConfig } from "./config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

let payload: Payload;
let restClient: NextRESTClient;

describe("Plugin tests", () => {
  beforeAll(async () => {
    process.env.DISABLE_PAYLOAD_HMR = "true";
    process.env.PAYLOAD_DROP_DATABASE = "true";

    dotenv.config({
      path: path.resolve(dirname, "./.env"),
    });

    if (!process.env.DATABASE_URI) {
      console.log("Starting memory database");
      const postgresContainer = await new PostgreSqlContainer()
        .withExposedPorts(5432)
        .withUsername("postgres")
        .withPassword("brugrappling")
        .withDatabase("bookings_test")
        .start();

      const host = postgresContainer.getHost();
      const port = postgresContainer.getMappedPort(5432);
      const databaseUri = `postgresql://postgres:brugrappling@${host}:${port}/bookings_test`;

      console.log("PostgreSQL database started");
      process.env.DATABASE_URI = databaseUri;
    }

    const config = await createConfig(process.env.DATABASE_URI);

    payload = await getPayload({ config: config });
    restClient = new NextRESTClient(config);
  });

  it("should should get the lessons endpoint", async () => {
    const response = await restClient.GET("/lessons");
    expect(response.status).toBe(200);
  });
  it("should have a booking status of active", async () => {
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
        start_time: new Date(Date.now() + 2 * 60 * 60 * 1000),
        end_time: new Date(Date.now() + 3 * 60 * 60 * 1000),
        class_option: classOption.id,
        location: "Test Location",
      },
    });

    const response = await restClient.GET(`/lessons/${lesson.id}`);

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.booking_status).toBe("active");
  });
});
