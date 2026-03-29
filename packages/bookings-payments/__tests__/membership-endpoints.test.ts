/**
 * Membership endpoints: verify all membership endpoints are registered when membership is enabled.
 */
import { describe, it, expect } from "vitest";
import type { Config } from "payload";
import { bookingsPaymentsPlugin } from "../src/plugin";

describe("membership endpoints", () => {
  it("registers all membership endpoints including sync when membership is enabled and syncStripeSubscriptions is true", () => {
    const plugin = bookingsPaymentsPlugin({
      membership: { enabled: true, syncStripeSubscriptions: true },
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
    const result = plugin(incoming as Config) as Config;
    const endpoints = result.endpoints || [];
    
    const endpointPaths = endpoints.map((e) => 
      typeof e === "object" && e !== null && "path" in e ? e.path : null
    ).filter(Boolean) as string[];

    expect(endpointPaths).toContain("/stripe/plans");
    expect(endpointPaths).toContain("/stripe/subscriptions");
    expect(endpointPaths).toContain("/stripe/create-checkout-session");
    expect(endpointPaths).toContain("/stripe/create-customer-portal");
    expect(endpointPaths).toContain("/stripe/sync-stripe-subscriptions");
  });

  it("does not register sync-stripe-subscriptions when membership is enabled but syncStripeSubscriptions is false or omitted", () => {
    for (const membershipConfig of [
      { enabled: true, syncStripeSubscriptions: false },
      { enabled: true },
    ]) {
      const plugin = bookingsPaymentsPlugin({ membership: membershipConfig as { enabled: boolean; syncStripeSubscriptions?: boolean } });
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
      const result = plugin(incoming as Config) as Config;
      const endpoints = result.endpoints || [];
      const endpointPaths = endpoints.map((e) => 
        typeof e === "object" && e !== null && "path" in e ? e.path : null
      ).filter(Boolean) as string[];
      expect(endpointPaths).not.toContain("/stripe/sync-stripe-subscriptions");
      expect(endpointPaths).toContain("/stripe/plans");
    }
  });

  it("does not register membership endpoints when membership is disabled", () => {
    const plugin = bookingsPaymentsPlugin({
      classPass: { enabled: true },
      membership: { enabled: false },
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
    const result = plugin(incoming as Config) as Config;
    const endpoints = result.endpoints || [];
    
    const endpointPaths = endpoints.map((e) => 
      typeof e === "object" && e !== null && "path" in e ? e.path : null
    ).filter(Boolean) as string[];

    expect(endpointPaths).not.toContain("/stripe/plans");
    expect(endpointPaths).not.toContain("/stripe/subscriptions");
    expect(endpointPaths).not.toContain("/stripe/create-checkout-session");
    expect(endpointPaths).not.toContain("/stripe/create-customer-portal");
    expect(endpointPaths).not.toContain("/stripe/sync-stripe-subscriptions");
  });
});
