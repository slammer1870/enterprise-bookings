// File global polyfill for Node.js 18 - must run before undici loads
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

// Polyfill for jsdom environment - ensure URL and URLSearchParams are available
if (typeof globalThis.URL === 'undefined') {
  // @ts-expect-error - Node.js 18 has URL, but jsdom might need it
  globalThis.URL = URL;
}

// Any setup scripts you might need go here

// Load .env files
import 'dotenv/config'
