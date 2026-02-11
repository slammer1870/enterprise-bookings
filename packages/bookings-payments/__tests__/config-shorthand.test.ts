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
    slug: "class-options",
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

  it("accepts membership: { enabled: true, paymentMethodSlugs: ['class-options'] } for full config", () => {
    const plugin = bookingsPaymentsPlugin({
      membership: { enabled: true, paymentMethodSlugs: ["class-options"] },
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

  it("accepts classPass: { enabled: true, classOptionsSlug: 'class-options' } for full config", () => {
    const plugin = bookingsPaymentsPlugin({
      classPass: { enabled: true, classOptionsSlug: "class-options" },
    });
    const incoming: Partial<Config> = { collections: baseCollections };
    const result = plugin(incoming as Config) as Config;
    const slugs = result.collections?.map((c) => c.slug) ?? [];
    expect(slugs).toContain("class-pass-types");
    expect(slugs).toContain("class-passes");
  });

  it("accepts dropIns: true and enables drop-ins with defaults (paymentMethodSlugs: ['class-options'])", () => {
    const plugin = bookingsPaymentsPlugin({
      dropIns: true,
    });
    const incoming: Partial<Config> = { collections: baseCollections };
    const result = plugin(incoming as Config) as Config;
    const slugs = result.collections?.map((c) => c.slug) ?? [];
    expect(slugs).toContain("drop-ins");
  });

  it("accepts dropIns: { enabled: true, paymentMethodSlugs: ['class-options'] } for full config", () => {
    const plugin = bookingsPaymentsPlugin({
      dropIns: { enabled: true, paymentMethodSlugs: ["class-options"] },
    });
    const incoming: Partial<Config> = { collections: baseCollections };
    const result = plugin(incoming as Config) as Config;
    const slugs = result.collections?.map((c) => c.slug) ?? [];
    expect(slugs).toContain("drop-ins");
  });

  it("accepts payments: true and enables payments with defaults", () => {
    const plugin = bookingsPaymentsPlugin({
      payments: true,
    });
    const incoming: Partial<Config> = { collections: baseCollections };
    const result = plugin(incoming as Config) as Config;
    const slugs = result.collections?.map((c) => c.slug) ?? [];
    expect(slugs).toContain("transactions");
    const endpoints = result.endpoints ?? [];
    const paths = endpoints.map((e) => (typeof e === "object" && e !== null && "path" in e ? e.path : null)).filter(Boolean) as string[];
    expect(paths).toContain("/stripe/customers");
    expect(paths).toContain("/stripe/create-payment-intent");
  });

  it("accepts payments: { enabled: true } for full config", () => {
    const plugin = bookingsPaymentsPlugin({
      payments: { enabled: true },
    });
    const incoming: Partial<Config> = { collections: baseCollections };
    const result = plugin(incoming as Config) as Config;
    const slugs = result.collections?.map((c) => c.slug) ?? [];
    expect(slugs).toContain("transactions");
  });

  it("can combine boolean and object config in one call", () => {
    const plugin = bookingsPaymentsPlugin({
      classPass: true,
      membership: { enabled: true, paymentMethodSlugs: ["class-options"] },
    });
    const incoming: Partial<Config> = { collections: baseCollections };
    const result = plugin(incoming as Config) as Config;
    const slugs = result.collections?.map((c) => c.slug) ?? [];
    expect(slugs).toContain("class-passes");
    expect(slugs).toContain("plans");
    expect(slugs).toContain("subscriptions");
  });
});
