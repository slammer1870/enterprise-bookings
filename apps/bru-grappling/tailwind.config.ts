import type { Config } from "tailwindcss";
import baseConfig from "@repo/ui/tailwind.config";

const config = {
  ...baseConfig,
  content: [
    ...(baseConfig.content as string[]),
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/blocks/**/*.{ts,tsx}",
    "./src/globals/**/*.{ts,tsx}",
    "../../packages/ui/src/components/**/*.{ts,tsx}",
    "../../packages/bookings-plugin/src/components/**/*.{ts,tsx}",
    "../../packages/auth/src/components/**/*.{ts,tsx}",
    "../../packages/payments-plugin/src/components/**/*.{ts,tsx}",
    "../../packages/children/src/components/**/*.{ts,tsx}",
    "../../packages/memberships/src/components/**/*.{ts,tsx}",
    "./node_modules/@daveyplate/better-auth-ui/dist/**/*.{js,ts,jsx,tsx,mdx}",
  ],
} satisfies Config;

export default config;
