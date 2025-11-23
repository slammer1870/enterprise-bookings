import type { Config } from "tailwindcss";

const config = {
  darkMode: ["class"],
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/blocks/**/*.{ts,tsx}",
    "../../packages/ui/src/components/**/*.{ts,tsx}",
    "../../packages/bookings/src/components/**/*.{ts,tsx}",
    "../../packages/auth/src/components/**/*.{ts,tsx}",
    "../../packages/payments/src/components/**/*.{ts,tsx}",
    "../../apps/bru-grappling/src/blocks/**/*.{ts,tsx}",
    "../../apps/bru-grappling/src/globals/**/*.{ts,tsx}",
    "../../apps/kyuzo/src/blocks/**/*.{ts,tsx}",
    "../../apps/kyuzo/src/globals/**/*.{ts,tsx}",
    "../../apps/kyuzo/src/graphics/**/*.{ts,tsx}",
    "../../packages/e2e-kyuzo/src/blocks/**/*.{ts,tsx}",
    "../../packages/e2e-kyuzo/src/globals/**/*.{ts,tsx}",
    "../../packages/e2e-kyuzo/src/graphics/**/*.{ts,tsx}",
    "../../packages/e2e-kyuzo/src/app/(frontend)/**/*.{ts,tsx,js,jsx}",
    "../../packages/website/src/blocks/**/*.{ts,tsx}",
    "./node_modules/@daveyplate/better-auth-ui/dist/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  plugins: [
    require("tailwindcss-animate"),
    require("@tailwindcss/typography"),
  ],
} satisfies Config;

export default config;
