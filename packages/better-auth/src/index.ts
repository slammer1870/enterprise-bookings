import type { BetterAuthOptions, BetterAuthPlugin } from "better-auth";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

export interface InitAuthOptions {
  baseUrl: string;
  productionUrl: string;
  secret: string | undefined;
  db: NodePgDatabase<any>;
  betterAuthOptions: BetterAuthOptions;
  extraPlugins?: BetterAuthPlugin[];
}

export function initAuth(options: InitAuthOptions) {
  const {
    baseUrl,
    productionUrl,
    secret,
    db,
    betterAuthOptions,
    extraPlugins = [],
  } = options;

  // Merge plugins
  const plugins = [...(betterAuthOptions.plugins || []), ...extraPlugins];

  const config: BetterAuthOptions = {
    ...betterAuthOptions,
    database: drizzleAdapter(db, {
      provider: "pg",
    }),
    baseURL: baseUrl,
    secret,
    trustedOrigins: betterAuthOptions.trustedOrigins || [
      baseUrl,
      productionUrl,
    ],
    plugins: plugins.length > 0 ? plugins : undefined,
  };

  return betterAuth(config);
}

export type Auth = ReturnType<typeof initAuth>;
export type Session = Auth["$Infer"]["Session"];

// Re-export types and utilities
export type { BetterAuthOptions, BetterAuthPlugin } from "better-auth";
export { createBetterAuthOptions } from "./utils/create-options";
export type {
  CreateBetterAuthOptionsParams,
  EnabledFeatures,
} from "./utils/create-options";
