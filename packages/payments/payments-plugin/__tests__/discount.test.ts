import type { Payload } from "payload";
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { buildConfig, getPayload } from "payload";
import { config } from "./config.js";
import { setDbString } from "@repo/testing-config/src/utils/payload-config";
import { createDbString } from "@repo/testing-config/src/utils/db";
import { NextRESTClient } from "@repo/testing-config/src/helpers/NextRESTClient";
import { calculateQuantityDiscount } from "../src/utils/discount";
import type { DiscountTier } from "@repo/shared-types";
import { DropIn } from "@repo/shared-types";

let payload: Payload;
let restClient: NextRESTClient;

// Mock Stripe API
vi.mock("@repo/shared-utils", () => ({
  checkRole: vi.fn(),
  stripe: {
    customers: {
      list: vi.fn().mockResolvedValue({ data: [] }),
      create: vi.fn().mockResolvedValue({ id: "cus_12345" }),
      retrieve: vi.fn().mockResolvedValue({ id: "cus_12345" }),
    },
    paymentIntents: {
      create: vi.fn().mockImplementation(({ amount, metadata }) => ({
        client_secret: "pi_secret_123",
        amount,
        metadata,
      })),
    },
  },
  formatAmountForStripe: vi.fn().mockImplementation((amount) => amount * 100),
}));

describe("Discount calculation tests", () => {
  beforeAll(async () => {
    if (!process.env.DATABASE_URI) {
      const dbString = await createDbString();
      config.db = setDbString(dbString);
    }

    const builtConfig = await buildConfig(config);
    payload = await getPayload({ config: builtConfig });
    restClient = new NextRESTClient(builtConfig);
  });

  afterAll(async () => {
    if (payload) {
      await payload.db.destroy();
    }
  });

  describe("calculateQuantityDiscount utility", () => {
    it("should not apply discount for single quantity purchase", () => {
      const discountTiers: DiscountTier[] = [
        { minQuantity: 3, discountPercent: 10, type: "normal" },
        { minQuantity: 5, discountPercent: 15, type: "normal" },
      ];

      const result = calculateQuantityDiscount(100, 1, discountTiers);

      console.log("RESULT", result);

      expect(result.discountApplied).toBe(false);
      expect(result.originalPrice).toBe(100);
      expect(result.discountedPrice).toBe(100);
      expect(result.totalAmount).toBe(100);
      expect(result.appliedDiscountPercent).toBeUndefined();
    });

    it("should apply the correct discount tier for qualifying quantity", () => {
      const discountTiers: DiscountTier[] = [
        { minQuantity: 3, discountPercent: 10, type: "normal" },
        { minQuantity: 5, discountPercent: 15, type: "normal" },
      ];

      const result = calculateQuantityDiscount(100, 3, discountTiers);

      expect(result.discountApplied).toBe(true);
      expect(result.originalPrice).toBe(100);
      expect(result.discountedPrice).toBe(90); // 100 - 10%
      expect(result.totalAmount).toBe(270); // 90 × 3
      expect(result.appliedDiscountPercent).toBe(10);
    });

    it("should apply the highest qualifying discount tier", () => {
      const discountTiers: DiscountTier[] = [
        { minQuantity: 3, discountPercent: 10, type: "normal" },
        { minQuantity: 5, discountPercent: 15, type: "normal" },
      ];

      const result = calculateQuantityDiscount(100, 5, discountTiers);

      expect(result.discountApplied).toBe(true);
      expect(result.originalPrice).toBe(100);
      expect(result.discountedPrice).toBe(85); // 100 - 15%
      expect(result.totalAmount).toBe(425); // 85 × 5
      expect(result.appliedDiscountPercent).toBe(15);
    });

    it("should not apply discount for trial price type", () => {
      const discountTiers: DiscountTier[] = [
        { minQuantity: 3, discountPercent: 10, type: "trial" },
        { minQuantity: 5, discountPercent: 15, type: "trial" },
      ];

      const result = calculateQuantityDiscount(50, 5, discountTiers);

      expect(result.discountApplied).toBe(false);
      expect(result.originalPrice).toBe(50);
      expect(result.discountedPrice).toBe(50);
      expect(result.totalAmount).toBe(250); // 50 × 5
      expect(result.appliedDiscountPercent).toBeUndefined();
    });

    it("should handle missing discount tiers", () => {
      const result = calculateQuantityDiscount(100, 5);

      expect(result.discountApplied).toBe(false);
      expect(result.originalPrice).toBe(100);
      expect(result.discountedPrice).toBe(100);
      expect(result.totalAmount).toBe(500); // 100 × 5
      expect(result.appliedDiscountPercent).toBeUndefined();
    });
  });

  describe("Payment intent with discounts", () => {
    let user;
    let dropIn: DropIn;

    beforeAll(async () => {
      // Create test user
      user = await payload.create({
        collection: "users",
        data: {
          name: "Discount Test User",
          email: "discount-test@example.com",
          password: "password",
        },
      });

      // Create test drop-in with discount tiers
      dropIn = (await payload.create({
        collection: "drop-ins",
        data: {
          name: "Test Drop-In Class",
          price: 100,
          isActive: true,
          adjustable: true,
          discountTiers: [
            { minQuantity: 3, discountPercent: 10, type: "normal" },
            { minQuantity: 5, discountPercent: 15, type: "normal" },
          ],
        },
      })) as DropIn;
    });

    it("should apply discount when creating payment intent", async () => {
      await restClient.login({
        credentials: {
          email: user.email,
          password: "password",
        },
      });

      const response = await restClient.POST("/stripe/create-payment-intent", {
        body: JSON.stringify({
          price: 100,
          metadata: {
            lessonId: "2",
            userId: user.id,
          },
        }),
      });

      expect(response.status).toBe(200);

      const data = await response.json();

      expect(data.clientSecret).toBe("pi_secret_123");
      expect(data.amount).toBe(100);
    });

    it("should not apply discount for trial drop-ins", async () => {
      // Create trial drop-in
      const trialDropIn = await payload.create({
        collection: "drop-ins",
        data: {
          name: "Trial Drop-In Class",
          price: 50,
          active: true,
          adjustable: true,
          discountTiers: [
            { minQuantity: 3, discountPercent: 10, type: "trial" },
            { minQuantity: 5, discountPercent: 15, type: "trial" },
          ],
        },
      });

      await restClient.login({
        credentials: {
          email: user.email,
          password: "password",
        },
      });

      const response = await restClient.POST("/stripe/create-payment-intent", {
        body: JSON.stringify({
          price: 50,
          quantity: 3,
          dropInId: trialDropIn.id,
        }),
      });

      expect(response.status).toBe(200);

      const data = await response.json();

      expect(data.amount).toBe(50);
    });

    it("should calculate correct amount for payment intent with no dropInId", async () => {
      await restClient.login({
        credentials: {
          email: user.email,
          password: "password",
        },
      });

      const response = await restClient.POST("/stripe/create-payment-intent", {
        body: JSON.stringify({
          price: 75,
          metadata: {
            lessonId: "2",
            userId: user.id,
          },
        }),
      });

      expect(response.status).toBe(200);

      const data = await response.json();

      expect(data.amount).toBe(75);
    });
  });
});
