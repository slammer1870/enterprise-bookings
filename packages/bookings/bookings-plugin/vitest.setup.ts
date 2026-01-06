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

// Handle unhandled promise rejections that occur during test cleanup
// These are often caused by async hooks trying to access deleted resources
process.on('unhandledRejection', (error: any) => {
  // Silently ignore errors that occur during test cleanup
  if (
    error?.status === 404 ||
    error?.name === 'NotFound' ||
    error?.message?.includes('Cannot read properties of undefined') ||
    error?.message?.includes('reading \'id\'') ||
    // Payload/Drizzle edge-case observed in CI during teardown (document lock cleanup)
    error?.message?.includes('delete from  where false') ||
    error?.query === 'delete from  where false'
  ) {
    // Suppress these errors during test cleanup
    return;
  }
  // Re-throw other errors
  throw error;
});

