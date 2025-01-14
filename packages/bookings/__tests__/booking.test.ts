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

let payload: Payload;
let restClient: NextRESTClient;

describe("Plugin tests", () => {
  beforeAll(async () => {
    if (!process.env.DATABASE_URI) {
      const dbString = await createDbString();
      process.env.DATABASE_URI = dbString;

      config.db = setDbString(dbString);
    }

    const builtConfig = await buildConfig(config);

    payload = await getPayload({ config: builtConfig });
    restClient = new NextRESTClient(builtConfig);
  });

  it("should be unauthorized to get the bookings endpoint", async () => {
    const response = await restClient.GET("/bookings");
    expect(response.status).toBe(403);
  });
});
