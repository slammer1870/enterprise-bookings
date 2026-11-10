/**
 * Hostname helpers the edge middleware can import.
 * Keep Node DNS and the Payload client out of this file.
 */

/** Root hostname from NEXT_PUBLIC_SERVER_URL (e.g. atnd-me.com). */
export function getPlatformRootHostname(): string | null {
  const url = process.env.NEXT_PUBLIC_SERVER_URL
  if (!url) return null
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
}

/** Trim, lowercase, and drop a port. Does not validate. */
export function normalizeCustomDomain(value: string): string {
  let s = value.trim().toLowerCase()
  const portIdx = s.indexOf(':')
  if (portIdx !== -1) {
    s = s.slice(0, portIdx)
  }
  return s.trim()
}
