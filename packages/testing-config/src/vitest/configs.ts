import type { UserConfig } from 'vitest/config';

/**
 * File global polyfill for Node.js 18
 * This needs to be run before undici loads
 */
function setupFilePolyfill() {
  if (typeof globalThis.File === 'undefined') {
    class FilePolyfill extends Blob {
      constructor(
        bits: BlobPart[],
        name: string,
        options?: FilePropertyBag,
      ) {
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
}

// Setup File polyfill immediately
setupFilePolyfill();

/**
 * Base vitest configuration shared across all packages
 */
export const baseConfig: UserConfig = {
  test: {
    globals: true,
  },
};

/**
 * Node.js environment config
 */
export const nodeConfig: UserConfig = {
  ...baseConfig,
  test: {
    ...baseConfig.test,
    environment: 'node',
    hookTimeout: 100000,
  },
};

