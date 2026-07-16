import { defineConfig, mergeConfig, type UserConfig } from 'vitest/config';

if (typeof globalThis.File === 'undefined') {
  class FilePolyfill extends Blob {
    constructor(bits: BlobPart[], name: string, options?: FilePropertyBag) {
      super(bits, options);
      Object.defineProperty(this, 'name', {
        value: name,
        writable: false,
        enumerable: true,
        configurable: true,
      });
      Object.defineProperty(this, 'lastModified', {
        value: options?.lastModified ?? Date.now(),
        writable: false,
        enumerable: true,
        configurable: true,
      });
    }
  }
  globalThis.File = FilePolyfill as unknown as typeof File;
}

const baseVitestConfig: UserConfig = {
  test: {
    globals: true,
    server: {
      deps: {
        inline: ['@repo/testing-config'],
      },
    },
  },
  resolve: {
    extensionAlias: {
      '.js': ['.ts', '.js'],
    },
  } as UserConfig['resolve'],
};

/**
 * Vitest configuration for Node.js environment tests.
 */
export function createNodeConfig(
  config: UserConfig = {},
): ReturnType<typeof defineConfig> {
  const mergedSetupFiles = [
    ...(baseVitestConfig.test?.setupFiles || []),
    ...(config.test?.setupFiles || []),
  ];

  return defineConfig(
    mergeConfig(baseVitestConfig, {
      test: {
        environment: 'node',
        hookTimeout: 100_000,
        setupFiles: mergedSetupFiles.length > 0 ? mergedSetupFiles : undefined,
        ...config.test,
      },
      ...config,
    }),
  );
}

export type ForksNodeConfigOptions = Parameters<typeof createNodeConfig>[0];

/** Node vitest config with fork pool isolation (prevents mock leakage across files). */
export function createForksNodeConfig(config: ForksNodeConfigOptions = {}) {
  return createNodeConfig({
    test: {
      pool: 'forks',
      isolate: true,
      ...config?.test,
    },
    ...config,
  });
}

export const nodeVitestConfig = createNodeConfig();
