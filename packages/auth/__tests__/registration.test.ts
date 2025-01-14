import { beforeAll, describe, expect, it } from "vitest";

import { buildConfig, Endpoint, getPayload, Payload } from "payload";

import { user, config } from "./config";

import { createDbString } from "@repo/testing-config/src/utils/db";
import { setDbString } from "@repo/testing-config/src/utils/payload-config";

import { NextRESTClient } from "@repo/testing-config/src/helpers/NextRESTClient";

describe("Registration", async () => {
  let payload: Payload;
  let restClient: NextRESTClient;

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

  it("should register a new user", async () => {
    const response = await restClient.POST("/users", {
      body: JSON.stringify({
        name: user.name,
        email: user.email,
        password: user.password,
      }),
    });

    expect(response.status).toBe(201);
  });

  it("should fail because user already exists a new user", async () => {
    const response = await restClient.POST("/users", {
      body: JSON.stringify({
        name: user.name,
        email: user.email,
        password: user.password,
      }),
    });

    expect(response.status).toBe(400);
  });
});
