import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import payload, { Endpoint, Payload } from "payload";

import buildConfig, { user } from "./config";

import jwt from "jsonwebtoken";

import { createMocks } from "node-mocks-http";

describe("Verify Magic Link", async () => {
  let build: Payload;

  beforeAll(async () => {
    build = await payload.init({ config: buildConfig });
  });

  beforeEach(async () => {
    const existingUser = await build.find({
      collection: "users",
      where: {
        email: {
          equals: user.email,
        },
      },
    });

    user.id = existingUser.docs[0]?.id as string;

    if (!existingUser) {
      const createdUser = await build.create({
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
    await build.delete({
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
    const endpoints = build.collections.users.config.endpoints as Endpoint[];

    const endpoint = endpoints.find(
      (e) => e.path === "/verify-magic-link"
    ) as Endpoint;

    const fieldsToSign = {
      id: user.id,
      email: user.email,
      collection: "users",
    };

    const token = jwt.sign(fieldsToSign, build.secret, {
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
      payload: build,
    });

    const response = await endpoint.handler(req);

    expect(response.status).toBe(302);

    expect(response.headers.get("Location")).toBe("/dashboard");
  });
});
