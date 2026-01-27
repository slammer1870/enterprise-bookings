/**
 * Sync Stripe subscriptions job: plugin registers the task when membership is enabled,
 * and the task handler returns output from syncStripeSubscriptions.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Config } from "payload";
import { bookingsPaymentsPlugin } from "../src/plugin";
import { syncStripeSubscriptionsTask } from "../src/membership/tasks/sync-stripe-subscriptions";

const mockSync = vi.fn();
vi.mock("../src/membership/lib/sync-stripe-subscriptions", () => ({
  syncStripeSubscriptions: (...args: unknown[]) => mockSync(...args),
}));

describe("syncStripeSubscriptions job", () => {
  describe("plugin registration", () => {
    it("registers syncStripeSubscriptions task when membership is enabled", () => {
      const plugin = bookingsPaymentsPlugin({
        membership: { enabled: true },
      });
      const incoming: Partial<Config> = { collections: [] };
      const result = plugin(incoming as Config) as Config;
      const task = result.jobs?.tasks?.find(
        (t): t is { slug: string; handler: unknown } =>
          typeof t === "object" && t !== null && "slug" in t && t.slug === "syncStripeSubscriptions"
      );
      expect(task).toBeDefined();
      expect(task?.handler).toBeDefined();
    });

    it("does not register syncStripeSubscriptions task when membership is disabled", () => {
      const plugin = bookingsPaymentsPlugin({
        classPass: { enabled: true },
        membership: { enabled: false },
      });
      const incoming: Partial<Config> = { collections: [] };
      const result = plugin(incoming as Config) as Config;
      const task = result.jobs?.tasks?.find(
        (t): t is { slug: string } =>
          typeof t === "object" && t !== null && "slug" in t && t.slug === "syncStripeSubscriptions"
      );
      expect(task).toBeUndefined();
    });
  });

  describe("task handler", () => {
    beforeEach(() => {
      mockSync.mockReset();
    });

    it("returns output with count and newSubscriptionIds from sync result", async () => {
      mockSync.mockResolvedValue([{ id: 101 }, { id: 102 }]);
      const req = { payload: {}, context: {} };
      const result = await syncStripeSubscriptionsTask({
        req: req as never,
        input: {},
      } as never);
      expect(mockSync).toHaveBeenCalledWith(req.payload);
      expect(result).toEqual({
        output: { count: 2, newSubscriptionIds: [101, 102] },
      });
    });

    it("returns count 0 and empty newSubscriptionIds when sync returns no docs", async () => {
      mockSync.mockResolvedValue([]);
      const req = { payload: {}, context: {} };
      const result = await syncStripeSubscriptionsTask({
        req: req as never,
        input: {},
      } as never);
      expect(result).toEqual({
        output: { count: 0, newSubscriptionIds: [] },
      });
    });

    it("omits null/undefined ids from newSubscriptionIds", async () => {
      mockSync.mockResolvedValue([{ id: 1 }, { id: null }, { id: undefined }, { id: 2 }]);
      const req = { payload: {}, context: {} };
      const result = await syncStripeSubscriptionsTask({
        req: req as never,
        input: {},
      } as never);
      expect(result).toEqual({
        output: { count: 4, newSubscriptionIds: [1, 2] },
      });
    });
  });
});
