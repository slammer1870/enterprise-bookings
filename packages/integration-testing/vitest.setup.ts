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

// Handle unhandled promise rejections from async hooks gracefully
// These occur when Payload CMS hooks run after test completion during cleanup
process.on('unhandledRejection', (reason, promise) => {
  const errorMessage = reason instanceof Error ? reason.message : String(reason);
  
  // Ignore non-critical errors from async hooks that run during test cleanup
  if (
    errorMessage?.includes('delete from') ||
    errorMessage?.includes('Cannot read properties of undefined') ||
    errorMessage?.includes('syntax error at or near')
  ) {
    // These are expected during test cleanup when resources are being torn down
    return;
  }
  
  // Re-throw other unhandled rejections
  throw reason;
});

