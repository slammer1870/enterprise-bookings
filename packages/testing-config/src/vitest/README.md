# Vitest Configuration

Centralized vitest configurations for the monorepo, similar to how TypeScript and ESLint configs are structured.

## Available Configs

### Base Config (`base.ts`)
- Provides the File global polyfill for Node.js 18 (in Node.js 20+, File is available natively)
- Sets `globals: true` for all tests
- **This is automatically loaded** when you import any of the configs below

### Node Config (`node.ts`)
For backend/API packages that run tests in Node.js environment.

```typescript
import '@repo/testing-config/src/vitest/base';
import { createNodeConfig } from '@repo/testing-config/src/vitest/node';

export default createNodeConfig({
  test: {
    hookTimeout: 1000000,
    // ... additional test config
  },
});
```

**Use for:** `@repo/auth`, `@repo/bookings-plugin`, `@repo/payments-plugin`, `@repo/memberships`, `@repo/integration-testing`

### React Config (`react.ts`)
For frontend/app packages that need React/JSdom testing.

```typescript
import '@repo/testing-config/src/vitest/base';
import { createReactConfig } from '@repo/testing-config/src/vitest/react';

export default createReactConfig({
  test: {
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/int/**/*.int.spec.ts'],
  },
});
```

**Use for:** Apps like `boatyard-sauna` that test React components

### Node with React Config (`node-with-react.ts`)
For packages that need React plugins but run in Node.js environment.

```typescript
import '@repo/testing-config/src/vitest/base';
import { createNodeWithReactConfig } from '@repo/testing-config/src/vitest/node-with-react';

export default createNodeWithReactConfig({
  test: {
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/int/**/*.int.spec.ts'],
  },
});
```

**Use for:** Packages like `e2e-kyuzo` that need React support in Node.js tests

## Features

- **File Polyfill**: Automatically polyfills the `File` global for Node.js 18 compatibility
- **Shared Configuration**: Common settings like `globals: true` are configured once
- **Extensible**: Each config function accepts additional UserConfig to customize

## Migration

To migrate an existing `vitest.config.ts` to use the centralized config:

1. Import the base config to ensure File polyfill loads: `import '@repo/testing-config/src/vitest/base';`
2. Import and use the appropriate config function
3. Remove any duplicate File polyfill code
4. Customize with additional config as needed

Example migration:
```typescript
// Before
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    hookTimeout: 100000,
  },
});

// After
import '@repo/testing-config/src/vitest/base';
import { createNodeConfig } from '@repo/testing-config/src/vitest/node';
export default createNodeConfig({
  test: {
    hookTimeout: 100000,
  },
});
```

