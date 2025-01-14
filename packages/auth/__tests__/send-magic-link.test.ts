import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import payload, { buildConfig, Endpoint, getPayload, Payload } from "payload";

import { config, user } from "./config";

import { createMocks } from "node-mocks-http";
import { createDbString } from "../../testing-config/src/utils/db";
import { setDbString } from "../../testing-config/src/utils/payload-config";

describe("Magic Link", async () => {
  let payload: Payload;

  beforeAll(async () => {
    if (!process.env.DATABASE_URI) {
      const dbString = await createDbString();
      process.env.DATABASE_URI = dbString;

      config.db = setDbString(dbString);
    }

    const builtConfig = await buildConfig(config);

    payload = await getPayload({ config: builtConfig });

    await payload.create({
      collection: "users",
      data: user,
    });
  });
});

afterAll(async () => {
  if (payload.db.destroy) {
    await payload.db.destroy();
  }
});

it("should send a magic link to a user", async () => {
  const endpoints = payload.collections.users.config.endpoints as Endpoint[];

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
    payload: payload,
  });

  req.json = () => req.data;

  await endpoint.handler(req);

  expect(res._getStatusCode()).toBe(200);
});

it("should fail if the user does not exist", async () => {
  const endpoints = payload.collections.users.config.endpoints as Endpoint[];

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
    payload: payload,
  });

  req.json = () => req.data;

  await expect(endpoint.handler(req)).rejects.toThrow("User not found");
});
