import { beforeAll, describe, expect, it } from "vitest";

import { buildConfig, getPayload, Payload } from "payload";

import { config, user } from "./config";

import jwt from "jsonwebtoken";

import { createDbString } from "@repo/testing-config/src/utils/db";
import { setDbString } from "@repo/testing-config/src/utils/payload-config";
import { NextRESTClient } from "@repo/testing-config/src/helpers/NextRESTClient";

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

  it("should verify a magic link to log in a user", async () => {
    const fieldsToSign = {
      id: createdUser.id,
      email: createdUser.email,
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
});
