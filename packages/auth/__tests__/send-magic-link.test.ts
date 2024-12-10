import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import payload, { Endpoint, Payload } from "payload";

import buildConfig, { user } from "./config";

import { createMocks } from "node-mocks-http";
describe("Magic Link", async () => {
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

    try {
      if (existingUser.docs.length === 0) {
        await build.create({
          collection: "users",
          data: {
            name: user.name,
            email: user.email,
            password: user.password,
          },
        });
      }
    } catch (error) {
      console.error("Error creating user:", error);
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
  it("should send a magic link to a user", async () => {
    const endpoints = build.collections.users.config.endpoints as Endpoint[];

    const endpoint = endpoints.find(
      (e) => e.path === "/send-magic-link"
    ) as Endpoint;

    const { req, res } = createMocks({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      data: {
        name: user.name,
        email: user.email,
      },
      payload: build,
    });

    req.json = () => req.data;

    await endpoint.handler(req);

    expect(res._getStatusCode()).toBe(200);
  });

  it("should fail if the user does not exist", async () => {
    const endpoints = build.collections.users.config.endpoints as Endpoint[];

    const endpoint = endpoints.find(
      (e) => e.path === "/send-magic-link"
    ) as Endpoint;

    const { req } = createMocks({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      data: {
        name: user.name,
        email: "nonexistent@example.com",
      },
      payload: build,
    });

    req.json = () => req.data;

    await expect(endpoint.handler(req)).rejects.toThrow("User not found");
  });
});
