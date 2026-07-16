import type { UserConfig } from 'vitest/config';

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

/** @deprecated Import side effects from this module; config comes from createNodeConfig. */
export const baseVitestConfig: UserConfig = {
  test: {
    globals: true,
  },
};
