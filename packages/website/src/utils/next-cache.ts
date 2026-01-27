/**
 * Utility to safely import next/cache functions.
 * Uses dynamic imports to avoid module resolution errors in test environments.
 */

let revalidatePathCache: typeof import('next/cache')['revalidatePath'] | null = null
let revalidateTagCache: typeof import('next/cache')['revalidateTag'] | null = null
let cacheLoadPromise: Promise<void> | null = null

async function loadCacheFunctions() {
  if (cacheLoadPromise) {
    await cacheLoadPromise
    return
  }
  
  cacheLoadPromise = (async () => {
    try {
      // Try the standard import first
      const cache = await import('next/cache')
      revalidatePathCache = cache.revalidatePath
      revalidateTagCache = cache.revalidateTag
    } catch (error) {
      // If that fails, try the .js extension (for some Node.js versions)
      try {
        const cache = await import('next/cache.js')
        revalidatePathCache = cache.revalidatePath
        revalidateTagCache = cache.revalidateTag
      } catch {
        // If next/cache is not available (e.g., in test environments), use no-op functions
        revalidatePathCache = () => {}
        revalidateTagCache = () => {}
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
