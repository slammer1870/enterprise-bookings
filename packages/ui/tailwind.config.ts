import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";
import typography from "@tailwindcss/typography";

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
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [tailwindcssAnimate, typography],
} satisfies Config;

export default config;
