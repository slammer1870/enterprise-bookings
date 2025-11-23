/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/blocks/**/*.{ts,tsx}",
    "../../packages/ui/src/components/**/*.{ts,tsx}",
    "../../packages/bookings/src/components/**/*.{ts,tsx}",
    "../../packages/auth/src/components/**/*.{ts,tsx}",
    "../../packages/payments/src/components/**/*.{ts,tsx}",
    "../../apps/bru-grappling/src/**/*.{ts,tsx}",
    "../../apps/kyuzo/src/**/*.{ts,tsx}",
    "../../apps/darkhorse-strength/src/**/*.{ts,tsx}",
    "../../apps/mindful-yard/src/**/*.{ts,tsx}",
    "../../packages/e2e-kyuzo/src/**/*.{ts,tsx,js,jsx}",
    "../../packages/website/src/**/*.{ts,tsx}",
    "./node_modules/@daveyplate/better-auth-ui/dist/**/*.{js,ts,jsx,tsx,mdx}",
  ],
};

