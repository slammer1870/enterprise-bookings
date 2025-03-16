/* eslint-disable no-console */
/**
 * Here are your integration tests for the plugin.
 * They don't require running your Next.js so they are fast
 * Yet they still can test the Local API and custom endpoints using NextRESTClient helper.
 */

import type { Payload } from "payload";

import { beforeAll, describe, expect, it, vi, afterAll } from "vitest";

import { buildConfig, getPayload } from "payload";

import { config } from "./config.js";

import { setDbString } from "@repo/testing-config/src/utils/payload-config";
import { createDbString } from "@repo/testing-config/src/utils/db";

import { NextRESTClient } from "@repo/testing-config/src/helpers/NextRESTClient";

let payload: Payload;
let restClient: NextRESTClient;

// Increase the test timeout
const TEST_TIMEOUT = 15000; // 15 seconds

// Mock the createCheckoutSession function
vi.mock("../src/endpoints/create-checkout-session", () => ({
  createCheckoutSession: vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        client_secret: "mock_client_secret",
        url: "https://mock-checkout.stripe.com",
      }),
      {
        status: 200,
      }
    )
  ),
}));

// Mock the createCustomerPortal function
vi.mock("../src/endpoints/create-customer-portal", () => ({
  createCustomerPortal: vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        url: "https://mock-customer-portal.stripe.com",
      }),
      {
        status: 200,
      }
    )
  ),
}));

describe("Users tests", () => {
  beforeAll(async () => {
    if (!process.env.DATABASE_URI) {
      const dbString = await createDbString();

      config.db = setDbString(dbString);
    }

    const builtConfig = await buildConfig(config);

    payload = await getPayload({ config: builtConfig });
    restClient = new NextRESTClient(builtConfig);
  });

  it(
    "should should return a checkout session url",
    async () => {
      const user = await payload.create({
        collection: "users",
        data: {
          email: "test@example.com",
          password: "password",
        },
      });

      const response = await restClient
        .login({
          credentials: {
            email: user.email,
            password: "password",
          },
        })
        .then(() =>
          restClient.POST("/stripe/create-checkout-session", {
            body: JSON.stringify({
              price: "price_12345",
              quantity: 1,
              metadata: {
                user_id: user.id,
              },
            }),
          })
        );

      const data = await response.json();

      expect(response.status).toBe(200);

      expect(data.url).toBe("https://mock-checkout.stripe.com");
    },
    TEST_TIMEOUT
  );

  it(
    "should return a customer portal url",
    async () => {
      const user = await payload.create({
        collection: "users",
        data: {
          email: "test1@example.com",
          password: "password",
          stripeCustomerId: "cus_mockId",
        },
      });

      const response = await restClient
        .login({
          credentials: {
            email: user.email,
            password: "password",
          },
        })
        .then(() =>
          restClient.POST("/stripe/create-customer-portal", {
            body: JSON.stringify({
              user_id: user.id,
            }),
          })
        );

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.url).toBe("https://mock-customer-portal.stripe.com");
    },
    TEST_TIMEOUT
  );
});
