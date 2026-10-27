import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createReactConfig } from '@repo/testing-config/src/vitest/react';
import tsconfigPaths from 'vite-tsconfig-paths';
import react from '@vitejs/plugin-react';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const stripeReact = path.resolve(
  dirname,
  '../../payments/payments-next/node_modules/@stripe/react-stripe-js',
);
const stripeJs = path.resolve(
  dirname,
  '../../payments/payments-next/node_modules/@stripe/stripe-js',
);

export default createReactConfig({
  // @ts-expect-error - Version mismatch between vite/vitest types in monorepo causes plugin type incompatibility
  plugins: [tsconfigPaths(), react()],
  resolve: {
    alias: {
      '@stripe/react-stripe-js': stripeReact,
      '@stripe/stripe-js': stripeJs,
    },
  },
  test: {
    setupFiles: ['./vitest.setup.ts'],
    include: ['__tests__/**/*.test.tsx', '__tests__/**/*.test.ts'],
    server: {
      deps: {
        inline: ['@stripe/react-stripe-js', '@stripe/stripe-js'],
      },
    },
  },
});
