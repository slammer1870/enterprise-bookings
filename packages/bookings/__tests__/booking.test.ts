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
    restClient = new NextRESTClient(payload.config);
  });

  it("should query added by plugin custom endpoint", async () => {
    const response = await restClient.GET("/api/lessons");
    expect(response.status).toBe(404);

    const data = await response.json();
  });

  it("can create post with a custom text field added by plugin", async () => {
    const post = await payload.create({
      collection: "posts",
      data: {
        addedByPlugin: "added by plugin",
      },
    });

    expect(post.addedByPlugin).toBe("added by plugin");
  });

  it("plugin creates and seeds plugin-collection", async () => {
    expect(payload.collections["plugin-collection"]).toBeDefined();

    const { docs } = await payload.find({ collection: "plugin-collection" });

    expect(docs).toHaveLength(1);
  });
});
