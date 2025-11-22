import type { Config } from "tailwindcss";
import baseConfig from "@repo/ui/tailwind.config";

const config = {
  ...baseConfig,
  content: [
    ...(baseConfig.content as string[]),
    "./node_modules/@daveyplate/better-auth-ui/dist/**/*.{js,ts,jsx,tsx,mdx}",
  ],
} satisfies Config;

export default config;
