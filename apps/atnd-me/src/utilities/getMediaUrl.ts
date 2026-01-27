import { getClientSideURL } from '@/utilities/getURL'

/**
 * Processes media resource URL to ensure proper formatting
 * @param url The original URL from the resource
 * @param cacheTag Optional cache tag to append to the URL
 * @returns Properly formatted URL with cache tag if provided
 * 
 * For multi-tenant subdomains, we use relative URLs when possible to avoid Next.js Image hostname restrictions
 */
export const getMediaUrl = (url: string | null | undefined, cacheTag?: string | null): string => {
  if (!url) return ''

  if (cacheTag && cacheTag !== '') {
    cacheTag = encodeURIComponent(cacheTag)
  }

  // Check if URL already has http/https protocol
  if (url.startsWith('http://') || url.startsWith('https://')) {
    // For absolute URLs on the same origin (including subdomains), convert to relative URL
    // This avoids Next.js Image hostname restrictions for subdomains
    if (typeof window !== 'undefined') {
      try {
        const urlObj = new URL(url)
        const currentOrigin = window.location.origin
        // If same origin or localhost subdomain, use relative URL
        if (urlObj.origin === currentOrigin || 
            (urlObj.hostname.includes('localhost') && window.location.hostname.includes('localhost'))) {
          const relativeUrl = urlObj.pathname + urlObj.search
          return cacheTag ? `${relativeUrl}?${cacheTag}` : relativeUrl
        }
      } catch {
        // If URL parsing fails, return as-is
      }
    }
    return cacheTag ? `${url}?${cacheTag}` : url
  }

  // For relative URLs, use as-is (Next.js Image will handle optimization)
  // The base URL is not needed since we're using relative URLs
  return cacheTag ? `${url}?${cacheTag}` : url
}
