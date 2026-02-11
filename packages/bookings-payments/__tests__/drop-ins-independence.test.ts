/**
 * Drop-ins independence: verify drop-ins can be enabled independently of payments, class-pass, and membership.
 */
import { describe, it, expect } from "vitest";
import type { Config } from "payload";
import { bookingsPaymentsPlugin } from "../src/plugin";

describe("drop-ins independence", () => {
  it("can enable drop-ins independently without payments, class-pass, or membership", () => {
    const plugin = bookingsPaymentsPlugin({
      dropIns: {
        enabled: true,
        paymentMethodSlugs: ["class-options"],
      },
    });
    const incoming: Partial<Config> = {
      collections: [
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
      ],
    };
    const result = plugin(incoming as Config) as Config;
    const slugs = result.collections?.map((c) => c.slug) ?? [];

    // Should have drop-ins collection
    expect(slugs).toContain("drop-ins");
    // Should NOT have transactions (payments)
    expect(slugs).not.toContain("transactions");
    // Should NOT have class-pass-types or class-passes
    expect(slugs).not.toContain("class-pass-types");
    expect(slugs).not.toContain("class-passes");
    // Should NOT have plans/subscriptions
    expect(slugs).not.toContain("plans");
    expect(slugs).not.toContain("subscriptions");
    // Should NOT have transactions (only added when classPass or payments enabled)
    expect(slugs).not.toContain("transactions");
  });

  it("can enable drop-ins with class-pass", () => {
    const plugin = bookingsPaymentsPlugin({
      dropIns: {
        enabled: true,
        paymentMethodSlugs: ["class-options"],
      },
      classPass: {
        enabled: true,
        classOptionsSlug: "class-options",
      },
    });
    const incoming: Partial<Config> = {
      collections: [
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
      ],
    };
    const result = plugin(incoming as Config) as Config;
    const slugs = result.collections?.map((c) => c.slug) ?? [];

    expect(slugs).toContain("drop-ins");
    expect(slugs).toContain("class-pass-types");
    expect(slugs).toContain("class-passes");
    expect(slugs).toContain("transactions");
  });

  it("can enable drop-ins with membership", () => {
    const plugin = bookingsPaymentsPlugin({
      dropIns: {
        enabled: true,
        paymentMethodSlugs: ["class-options"],
      },
      membership: {
        enabled: true,
        paymentMethodSlugs: ["class-options"],
      },
    });
    const incoming: Partial<Config> = {
      collections: [
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
      ],
    };
    const result = plugin(incoming as Config) as Config;
    const slugs = result.collections?.map((c) => c.slug) ?? [];

    expect(slugs).toContain("drop-ins");
    expect(slugs).toContain("plans");
    expect(slugs).toContain("subscriptions");
    // Should NOT have transactions (only added when classPass or payments enabled)
    expect(slugs).not.toContain("transactions");
  });

  it("requires paymentMethodSlugs when drop-ins enabled", () => {
    const plugin = bookingsPaymentsPlugin({
      dropIns: {
        enabled: true,
        // paymentMethodSlugs missing
      },
    });
    const incoming: Partial<Config> = {
      collections: [
        {
          slug: "users",
          admin: { useAsTitle: "email" },
          auth: true,
          fields: [],
        },
      ],
    };
    expect(() => plugin(incoming as Config)).toThrow("dropIns.paymentMethodSlugs is required");
  });
});
