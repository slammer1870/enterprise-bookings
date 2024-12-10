import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import payload, { Endpoint, Payload } from "payload";

import buildConfig, { user } from "./config";

import { createMocks } from "node-mocks-http";
describe("Registration", async () => {
  let build: Payload;

  console.log("DATABASE URI", process.env.DATABASE_URI);

  beforeAll(async () => {
    build = await payload.init({ config: buildConfig });

    const existingUser = await build.find({
      collection: "users",
      where: {
        email: {
          equals: user.email,
        },
      },
    });

    if (existingUser) {
      await deleteUser();
    }
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

    if (existingUser) {
      await deleteUser();
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
    const existingUser = await build.find({
      collection: "users",
      where: {
        email: {
          equals: user.email,
        },
      },
    });

    if (existingUser.docs.length > 0) {
      await deleteUser();
    }
  });

  it("should register a new user", async () => {
    const endpoints = build.collections.users.config.endpoints as Endpoint[];

    const register = endpoints.find((e) => e.path === "/register") as Endpoint;

    const { req } = createMocks({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      data: {
        name: user.name,
        email: user.email,
        password: user.password,
      },
      payload: build,
    });

    req.json = () => req.data;

    const result = await register.handler(req);

    expect(result.status).toBe(200);
  });
});
