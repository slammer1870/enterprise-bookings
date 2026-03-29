/**
 * Drop-ins: unified with card payments; transactions at plugin root for any feature.
 */
import { describe, it, expect } from "vitest";
import type { Config } from "payload";
import { bookingsPaymentsPlugin } from "../src/plugin";

describe("drop-ins and transactions at root", () => {
  it("can enable drop-ins only and gets drop-ins + transactions + stripe endpoints", () => {
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
    const paths = (result.endpoints ?? [])
      .map((e) => (typeof e === "object" && e !== null && "path" in e ? e.path : null))
      .filter(Boolean) as string[];

    expect(slugs).toContain("drop-ins");
    expect(slugs).toContain("transactions");
    expect(slugs).not.toContain("class-pass-types");
    expect(slugs).not.toContain("class-passes");
    expect(slugs).not.toContain("plans");
    expect(slugs).not.toContain("subscriptions");
    expect(paths).toContain("/stripe/customers");
    expect(paths).toContain("/stripe/create-payment-intent");
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
    expect(slugs).toContain("transactions");
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
