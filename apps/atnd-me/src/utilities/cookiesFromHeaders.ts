/**
 * Minimal cookie store from a `Cookie` header for tenant resolution on API routes
 * (Next.js tRPC does not populate `req.cookies` on Payload local API calls).
 */
export function cookiesFromHeaders(headers: Headers): {
  get: (name: string) => { value?: string } | undefined
} {
  const raw = headers.get('cookie')
  if (!raw) {
    return { get: () => undefined }
  }

  const map = new Map<string, string>()
  for (const segment of raw.split(';')) {
    const trimmed = segment.trim()
    if (!trimmed) continue
    const eq = trimmed.indexOf('=')
    const name = (eq === -1 ? trimmed : trimmed.slice(0, eq)).trim()
    const value = eq === -1 ? '' : trimmed.slice(eq + 1).trim()
    if (!name) continue
    try {
      map.set(name, decodeURIComponent(value))
    } catch {
      map.set(name, value)
    }
  }

  return {
    get: (name: string) => {
      const v = map.get(name)
      return v !== undefined ? { value: v } : undefined
    },
  }
}
