import { beforeAll, describe, expect, it } from "vitest";
import { buildConfig, getPayload, Payload } from "payload";

import { config, user } from "./config";

import { createDbString } from "@repo/testing-config/src/utils/db";
import { setDbString } from "@repo/testing-config/src/utils/payload-config";
import { NextRESTClient } from "@repo/testing-config/src/helpers/NextRESTClient";

describe("Magic Link", async () => {
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

    await payload.create({
      collection: "users",
      data: user,
    });
  });

  it("should send a magic link to a user", async () => {
    const response = await restClient.POST("/users/send-magic-link", {
      body: JSON.stringify({
        email: user.email,
      }),
    });

    expect(response.status).toBe(200);
  });

  it("should fail if the user does not exist", async () => {
    const response = await restClient.POST("/users/send-magic-link", {
      body: JSON.stringify({
        email: "nonexistent@example.com",
      }),
    });

    expect(response.status).toBe(400);
  });
});
