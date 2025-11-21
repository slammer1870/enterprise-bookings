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

