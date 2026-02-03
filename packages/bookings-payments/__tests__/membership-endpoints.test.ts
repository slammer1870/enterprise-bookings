/**
 * Membership endpoints: verify all membership endpoints are registered when membership is enabled.
 */
import { describe, it, expect } from "vitest";
import type { Config } from "payload";
import { bookingsPaymentsPlugin } from "../src/plugin";

describe("membership endpoints", () => {
  it("registers all membership endpoints when membership is enabled", () => {
    const plugin = bookingsPaymentsPlugin({
      membership: { enabled: true },
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
