import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import payload, { buildConfig, Endpoint, getPayload, Payload } from "payload";

import { config, user } from "./config";

import jwt from "jsonwebtoken";

import { createMocks } from "node-mocks-http";

describe("Verify Magic Link", async () => {
  let payload: Payload;

  beforeAll(async () => {
    const builtConfig = await buildConfig(config);
    payload = await getPayload({ config: builtConfig });
  });

  beforeEach(async () => {
    const existingUser = await payload.find({
      collection: "users",
      where: {
        email: {
          equals: user.email,
        },
      },
    });

    user.id = existingUser.docs[0]?.id as string;

    if (!existingUser) {
      const createdUser = await payload.create({
        collection: "users",
        data: {
          name: user.name,
          email: user.email,
          password: user.password,
        },
      });

      user.id = createdUser.id as string;
    }
  });

  const deleteUser = async () => {
    await payload.delete({
      collection: "users",
      where: {
        email: {
          equals: user.email,
        },
      },
    });
  };

  afterEach(async () => {
    await deleteUser();
  });

  it("should verify a magic link to log in a user", async () => {
    const endpoints = payload.collections.users.config.endpoints as Endpoint[];

    const endpoint = endpoints.find(
      (e) => e.path === "/verify-magic-link"
    ) as Endpoint;

    const fieldsToSign = {
      id: user.id,
      email: user.email,
      collection: "users",
    };

    const token = jwt.sign(fieldsToSign, payload.secret, {
      expiresIn: "15m", // Token expires in 15 minutes
    });

    const { req } = createMocks({
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        token: token,
      },
      query: {
        token: token,
        callbackUrl: "/dashboard",
      },
      payload: payload,
    });

    const response = await endpoint.handler(req);

    expect(response.status).toBe(302);

    expect(response.headers.get("Location")).toBe("/dashboard");
  });
});
