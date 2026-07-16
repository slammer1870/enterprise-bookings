import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    testTimeout: 20000, // Keep global timeout reasonable; override specific slow tests where needed
    hookTimeout: 180000, // 3 min for DB container (createDbString) + getPayload
    // forks: process isolation so per-file vi.mock("@repo/shared-utils") cannot leak across files.
    // (vmThreads previously caused CI flakes: undefined spies, wrong Stripe mocks, DuplicateCollection.)
    pool: "forks",
    isolate: true,
  },
});
