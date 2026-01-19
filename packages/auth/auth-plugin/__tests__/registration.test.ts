import { beforeAll, afterAll, describe, expect, it } from "vitest";

import { buildConfig, getPayload, Payload } from "payload";

import { user, config } from "./config";

import { createDbString } from "@repo/testing-config/src/utils/db";
import { setDbString } from "@repo/payload-testing/src/utils/payload-config";

import { NextRESTClient } from "@repo/payload-testing/src/helpers/NextRESTClient";

describe("Registration", async () => {
  let payload: Payload;
  let restClient: NextRESTClient;

  const TEST_TIMEOUT = 30000; // 30 seconds
  const HOOK_TIMEOUT = 300000; // 5 minutes for setup hooks (DB + Payload init can be slow under turbo parallelism)

  beforeAll(async () => {
    if (!process.env.DATABASE_URI) {
      const dbString = await createDbString();

      config.db = setDbString(dbString);
    }

    const builtConfig = await buildConfig(config);

    payload = await getPayload({ config: builtConfig });
    restClient = new NextRESTClient(builtConfig);
  }, HOOK_TIMEOUT);

  afterAll(async () => {
    if (payload) {
      await payload.db.destroy();
    }
  });

  it(
    "should register a new user",
    async () => {
      const response = await restClient.POST("/users", {
        body: JSON.stringify({
          name: user.name,
          email: user.email,
          password: user.password,
        }),
      });

      expect(response.status).toBe(201);
    },
    TEST_TIMEOUT
  );

  it(
    "should fail because user already exists a new user",
    async () => {
      const response = await restClient.POST("/users", {
        body: JSON.stringify({
          name: user.name,
          email: user.email,
          password: user.password,
        }),
      });

      expect(response.status).toBe(400);
    },
    TEST_TIMEOUT
  );
});
