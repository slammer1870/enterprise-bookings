import { afterAll, beforeAll, describe, expect, it } from "vitest";

import payload, { buildConfig, Endpoint, getPayload, Payload } from "payload";

import { user, config } from "./config";

import { createMocks } from "node-mocks-http";

import { createDbString } from "../../testing-config/src/utils/db";
import { setDbString } from "../../testing-config/src/utils/payload-config";

describe("Registration", async () => {
  let payload: Payload;

  beforeAll(async () => {
    if (!process.env.DATABASE_URI) {
      const dbString = await createDbString();
      process.env.DATABASE_URI = dbString;

      config.db = setDbString(dbString);
    }

    const builtConfig = await buildConfig(config);

    payload = await getPayload({ config: builtConfig });
  });
});

afterAll(async () => {
  if (payload.db.destroy) {
    await payload.db.destroy();
  }
});

it("should register a new user", async () => {
  const endpoints = payload.collections.users.config.endpoints as Endpoint[];

  const endpoint = endpoints.find((e) => e.path === "/register") as Endpoint;

  const { req } = createMocks({
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: {
      name: user.name,
      email: user.email,
    },
    payload: payload,
  });

  req.json = () => req.data;

  const result = await endpoint.handler(req);

  expect(result.status).toBe(200);
});

it("should fail because user already exists a new user", async () => {
  const endpoints = payload.collections.users.config.endpoints as Endpoint[];

  const endpoint = endpoints.find((e) => e.path === "/register") as Endpoint;

  const { req } = createMocks({
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: {
      name: user.name,
      email: user.email,
    },
    payload: payload,
  });

  req.json = () => req.data;

  await expect(endpoint.handler(req)).rejects.toThrow("User already exists");
});
