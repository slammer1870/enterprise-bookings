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

let payload: Payload;
let restClient: NextRESTClient;

describe("Payments tests", () => {
  beforeAll(async () => {
    if (!process.env.DATABASE_URI) {
      const dbString = await createDbString();

      config.db = setDbString(dbString);
    }

    const builtConfig = await buildConfig(config);

    payload = await getPayload({ config: builtConfig });
    restClient = new NextRESTClient(builtConfig);
  });

  it("should should register a first user as an admin and create a stripe customer", async () => {
    const response = await restClient.POST("/users", {
      body: JSON.stringify({
        email: "test@example.com",
        password: "password",
        name: "Test User",
      }),
    });

    const data = await response.json();

    const payloadUser = await payload.findByID({
      collection: "users",
      id: data.doc.id,
    });

    expect(payloadUser.roles).toContain("admin");

    expect(payloadUser.stripeCustomerId).not.toBeNull();
  });
  it("should should register a second user as a customer and not be an admin and create a stripe customer", async () => {
    const response = await restClient.POST("/users", {
      body: JSON.stringify({
        email: "test2@example.com",
        password: "password",
        name: "Test User 2",
      }),
    });

    const data = await response.json();

    const payloadUser = await payload.findByID({
      collection: "users",
      id: data.doc.id,
    });

    expect(payloadUser.roles).not.toContain("admin");

    expect(payloadUser.stripeCustomerId).not.toBeNull();
  });
});
