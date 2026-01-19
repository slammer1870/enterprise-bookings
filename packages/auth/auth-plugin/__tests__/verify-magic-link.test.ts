import { beforeAll, afterAll, describe, expect, it } from "vitest";

import { buildConfig, getPayload, Payload } from "payload";

import { config, user } from "./config";

import jwt from "jsonwebtoken";

import { createDbString } from "@repo/testing-config/src/utils/db";
import { setDbString } from "@repo/payload-testing/src/utils/payload-config";
import { NextRESTClient } from "@repo/payload-testing/src/helpers/NextRESTClient";

describe("Verify Magic Link", async () => {
  let payload: Payload;
  let restClient: NextRESTClient;
  let createdUser: any;

  beforeAll(async () => {
    if (!process.env.DATABASE_URI) {
      const dbString = await createDbString();

      config.db = setDbString(dbString);
    }

    const builtConfig = await buildConfig(config);

    payload = await getPayload({ config: builtConfig });
    restClient = new NextRESTClient(builtConfig);

    createdUser = await payload.create({
      collection: "users",
      data: {
        name: user.name,
        email: user.email,
        password: user.password,
      },
    });
  });

  afterAll(async () => {
    if (payload) {
      await payload.db.destroy();
    }
  });

  it("should verify a magic link to log in a user", async () => {
    const fieldsToSign = {
      id: createdUser.id,
      collection: "users",
    };

    const token = jwt.sign(fieldsToSign, payload.secret, {
      expiresIn: "15m", // Token expires in 15 minutes
    });

    const response = await restClient.GET(
      `/users/verify-magic-link?token=${token}&callbackUrl=/dashboard`
    );

    expect(response.status).toBe(302);

    expect(response.headers.get("Location")).toBe("/dashboard");

    expect(response.headers.get("Set-Cookie")).toContain("payload-token");
  });
  it("should fail if the callback URL is invalid", async () => {
    const fieldsToSign = {
      id: createdUser.id,
      collection: "users",
    };

    const token = jwt.sign(fieldsToSign, payload.secret, {
      expiresIn: "15m", // Token expires in 15 minutes
    });

    const response = await restClient.GET(
      `/users/verify-magic-link?token=${token}&callbackUrl=https://evil.com`
    );

    expect(response.status).toBe(302);

    expect(response.headers.get("Location")).toBe("/");

    expect(response.headers.get("Set-Cookie")).toContain("payload-token");
  });
});
