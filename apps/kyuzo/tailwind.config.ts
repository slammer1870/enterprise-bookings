import baseConfig from "@repo/ui/tailwind.config";

/** @type {import('tailwindcss').Config} */
export default {
  ...baseConfig,
  content: [
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
    "../../packages/bookings-plugin/**/*.{ts,tsx}",
    "../../packages/auth/**/*.{ts,tsx}",
    "../../packages/payments-plugin/**/*.{ts,tsx}",
    "../../packages/website/**/*.{ts,tsx}",
  ],
};
