/**
 * Config shorthand: each feature can be enabled with `true` or a full config object.
 */
import { describe, it, expect } from "vitest";
import type { Config } from "payload";
import { bookingsPaymentsPlugin } from "../src/plugin";

const baseCollections: Partial<Config>["collections"] = [
  {
    slug: "users",
    admin: { useAsTitle: "email" },
    auth: true,
    fields: [],
  },
  {
    slug: "event-types",
    fields: [],
  },
];

describe("config shorthand (true | object)", () => {
  it("accepts membership: true and enables membership with defaults (sync is opt-in, so not registered)", () => {
    const plugin = bookingsPaymentsPlugin({
      membership: true,
    });
    const incoming: Partial<Config> = { collections: baseCollections };
    const result = plugin(incoming as Config) as Config;
    const slugs = result.collections?.map((c) => c.slug) ?? [];
    expect(slugs).toContain("plans");
    expect(slugs).toContain("subscriptions");
    expect(result.jobs?.tasks?.some((t) => typeof t === "object" && t !== null && "slug" in t && t.slug === "syncStripeSubscriptions") ?? false).toBe(false);
  });

  it("accepts membership: { enabled: true, syncStripeSubscriptions: true } and registers sync task and endpoint", () => {
    const plugin = bookingsPaymentsPlugin({
      membership: { enabled: true, syncStripeSubscriptions: true },
    });
    const incoming: Partial<Config> = { collections: baseCollections };
    const result = plugin(incoming as Config) as Config;
    expect(result.jobs?.tasks?.some((t) => typeof t === "object" && t !== null && "slug" in t && t.slug === "syncStripeSubscriptions")).toBe(true);
    const endpointPaths = (result.endpoints || []).map((e) => typeof e === "object" && e !== null && "path" in e ? e.path : null).filter(Boolean) as string[];
    expect(endpointPaths).toContain("/stripe/sync-stripe-subscriptions");
  });

  it("accepts membership: { enabled: true, paymentMethodSlugs: ['event-types'] } for full config", () => {
    const plugin = bookingsPaymentsPlugin({
      membership: { enabled: true, paymentMethodSlugs: ["event-types"] },
    });
    const incoming: Partial<Config> = { collections: baseCollections };
    const result = plugin(incoming as Config) as Config;
    const slugs = result.collections?.map((c) => c.slug) ?? [];
    expect(slugs).toContain("plans");
    expect(slugs).toContain("subscriptions");
  });

  it("accepts classPass: true and enables class-pass with defaults", () => {
    const plugin = bookingsPaymentsPlugin({
      classPass: true,
    });
    const incoming: Partial<Config> = { collections: baseCollections };
    const result = plugin(incoming as Config) as Config;
    const slugs = result.collections?.map((c) => c.slug) ?? [];
    expect(slugs).toContain("class-pass-types");
    expect(slugs).toContain("class-passes");
    expect(slugs).toContain("transactions");
  });

  it("accepts classPass: { enabled: true, eventTypesSlug: 'event-types' } for full config", () => {
    const plugin = bookingsPaymentsPlugin({
      classPass: { enabled: true, eventTypesSlug: "event-types" },
    });
    const incoming: Partial<Config> = { collections: baseCollections };
    const result = plugin(incoming as Config) as Config;
    const slugs = result.collections?.map((c) => c.slug) ?? [];
    expect(slugs).toContain("class-pass-types");
    expect(slugs).toContain("class-passes");
  });

  it("accepts dropIns: true and enables drop-ins + transactions + create-payment-intent + customers endpoint", () => {
    const plugin = bookingsPaymentsPlugin({
      dropIns: true,
    });
    const incoming: Partial<Config> = { collections: baseCollections };
    const result = plugin(incoming as Config) as Config;
    const slugs = result.collections?.map((c) => c.slug) ?? [];
    expect(slugs).toContain("drop-ins");
    expect(slugs).toContain("transactions");
    const paths = (result.endpoints ?? [])
      .map((e) => (typeof e === "object" && e !== null && "path" in e ? e.path : null))
      .filter(Boolean) as string[];
    expect(paths).toContain("/stripe/customers");
    expect(paths).toContain("/stripe/create-payment-intent");
  });

  it("accepts dropIns: { enabled: true, paymentMethodSlugs: ['event-types'] } for full config", () => {
    const plugin = bookingsPaymentsPlugin({
      dropIns: { enabled: true, paymentMethodSlugs: ["event-types"] },
    });
    const incoming: Partial<Config> = { collections: baseCollections };
    const result = plugin(incoming as Config) as Config;
    const slugs = result.collections?.map((c) => c.slug) ?? [];
    expect(slugs).toContain("drop-ins");
    expect(slugs).toContain("transactions");
  });

  it("adds transactions at root when only membership is enabled (subscription booking payments)", () => {
    const plugin = bookingsPaymentsPlugin({
      membership: true,
    });
    const incoming: Partial<Config> = { collections: baseCollections };
    const result = plugin(incoming as Config) as Config;
    const slugs = result.collections?.map((c) => c.slug) ?? [];
    expect(slugs).toContain("transactions");
    expect(slugs).toContain("plans");
    expect(slugs).toContain("subscriptions");
  });

  it("can combine boolean and object config in one call", () => {
    const plugin = bookingsPaymentsPlugin({
      classPass: true,
      membership: { enabled: true, paymentMethodSlugs: ["event-types"] },
    });
    const incoming: Partial<Config> = { collections: baseCollections };
    const result = plugin(incoming as Config) as Config;
    const slugs = result.collections?.map((c) => c.slug) ?? [];
    expect(slugs).toContain("class-passes");
    expect(slugs).toContain("plans");
    expect(slugs).toContain("subscriptions");
  });
});
