import type { Config } from "tailwindcss";
import sharedConfig from "@repo/ui/tailwind.config";

const config: Config = {
  ...sharedConfig,
  content: [
    "./src/**/*.{ts,tsx}",
    "../ui/src/components/**/*.{ts,tsx}",
    "../auth/src/components/**/*.{ts,tsx}",
    "../payments/src/components/**/*.{ts,tsx}",
    "../children/src/components/**/*.{ts,tsx}",
    "../memberships/src/components/**/*.{ts,tsx}",
  ],
};

export default config;
