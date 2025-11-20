// Polyfills for Node.js 18 / jsdom environment
// These MUST run before any modules load (especially webidl-conversions)

// Ensure URL APIs are available for jsdom/webidl-conversions
if (typeof globalThis.URL === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodeUrl = require('url');
  globalThis.URL = nodeUrl.URL;
  globalThis.URLSearchParams = nodeUrl.URLSearchParams;
}

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

// Load .env files after polyfills are set up
import 'dotenv/config'
