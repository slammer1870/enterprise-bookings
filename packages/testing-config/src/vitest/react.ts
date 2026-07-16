import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
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
};

export function createReactConfig(
  config: UserConfig = {},
): ReturnType<typeof defineConfig> {
  const mergedSetupFiles = [
    ...(baseVitestConfig.test?.setupFiles || []),
    ...(config.test?.setupFiles || []),
  ];

  return defineConfig(
    mergeConfig(
      mergeConfig(baseVitestConfig, config),
      {
        plugins: [tsconfigPaths(), react(), ...(config.plugins || [])],
        test: {
          environment: 'jsdom',
          setupFiles: mergedSetupFiles.length > 0 ? mergedSetupFiles : undefined,
        },
      },
    ),
  );
}

export const reactVitestConfig = createReactConfig();
