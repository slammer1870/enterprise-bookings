import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    hookTimeout: 180000, // 3 min for DB container (createDbString) + getPayload
    pool: "vmThreads", // required so deps.transformCss can handle .css from deps like react-image-crop
  },
});
