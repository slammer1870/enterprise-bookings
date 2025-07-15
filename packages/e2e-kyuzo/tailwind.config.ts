import baseConfig from '@repo/ui/tailwind.config'

const config = {
  ...baseConfig,
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/src/components/**/*.{ts,tsx}",
    "../../packages/bookings/src/components/**/*.{ts,tsx}",
    "../../packages/auth/src/components/**/*.{ts,tsx}",
    "../../packages/payments/src/components/**/*.{ts,tsx}",
  ],
}

export default config
