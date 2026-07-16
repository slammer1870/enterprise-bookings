/**
 * Utility to safely import next/cache functions.
 * Uses dynamic imports to avoid module resolution errors in test environments.
 */

let revalidatePathCache: typeof import('next/cache')['revalidatePath'] | null = null
let revalidateTagCache: typeof import('next/cache')['revalidateTag'] | null = null
let unstableCacheCache: typeof import('next/cache')['unstable_cache'] | null = null
let cacheLoadPromise: Promise<void> | null = null

function usePassthroughCache() {
  revalidatePathCache = () => {}
  revalidateTagCache = () => {}
  unstableCacheCache = <T extends (...args: unknown[]) => unknown>(fn: T) => fn as T
}

async function loadCacheFunctions() {
  if (cacheLoadPromise) {
    await cacheLoadPromise
    return
  }
  
  cacheLoadPromise = (async () => {
    // Vitest can import next/cache but has no Next.js request context
    // (incrementalCache). Use passthrough so unit tests exercise the real fn.
    if (process.env.VITEST) {
      usePassthroughCache()
      return
    }

    try {
      // Try the standard import first
      const cache = await import('next/cache')
      revalidatePathCache = cache.revalidatePath
      revalidateTagCache = cache.revalidateTag
      unstableCacheCache = cache.unstable_cache
    } catch (_error) {
      // If that fails, try the .js extension (for some Node.js versions)
      try {
        const cache = await import('next/cache.js')
        revalidatePathCache = cache.revalidatePath
        revalidateTagCache = cache.revalidateTag
        unstableCacheCache = cache.unstable_cache
      } catch {
        // If next/cache is not available (e.g., in test environments), use no-op functions
        usePassthroughCache()
      }
    }
  })()
  
  await cacheLoadPromise
}

export async function revalidatePath(path: string) {
  await loadCacheFunctions()
  return (revalidatePathCache || (() => {}))(path)
}

export async function revalidateTag(tag: string) {
  await loadCacheFunctions()
  return (revalidateTagCache || (() => {}))(tag)
}

export function unstable_cache<T>(
  fn: () => T | Promise<T>,
  keyParts?: string[],
  options?: { revalidate?: number; tags?: string[] }
): () => Promise<T> {
  // Start loading cache functions if not already started
  if (!cacheLoadPromise) {
    loadCacheFunctions().catch(() => {
      // Ignore errors during initial load
    })
  }
  
  // Return a function that will use the cache if available, otherwise just call fn
  return async () => {
    await loadCacheFunctions()
    if (unstableCacheCache) {
      // Wrap fn to always return a Promise (as required by Next.js's unstable_cache)
      const promiseFn = async () => {
        const result = fn()
        return result instanceof Promise ? result : Promise.resolve(result)
      }
      try {
        const cachedFn = unstableCacheCache(
          promiseFn as (...args: unknown[]) => Promise<unknown>,
          keyParts,
          options,
        )
        return (await cachedFn()) as T
      } catch (error) {
        // next/cache can load outside a Next request (e.g. scripts) and throw
        // "incrementalCache missing" — fall through to the uncached call.
        if (
          !(error instanceof Error) ||
          !error.message.includes('incrementalCache missing')
        ) {
          throw error
        }
      }
    }
    const result = fn()
    return result instanceof Promise ? result : Promise.resolve(result)
  }
}
