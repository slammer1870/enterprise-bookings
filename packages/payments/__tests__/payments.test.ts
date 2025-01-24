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

  it("should should get the customers endpoint", async () => {
    const user = await payload.create({
      collection: "users",
      data: {
        name: "Test User",
        email: "test@example.com",
        password: "password",
      },
    });

    const response = await restClient
      .login({
        credentials: {
          email: user.email,
          password: "password",
        },
      })
      .then(() => restClient.GET("/stripe/customers"));

    const data = await response.json();

    console.log(data);

    expect(response.status).toBe(200);
  });
});
