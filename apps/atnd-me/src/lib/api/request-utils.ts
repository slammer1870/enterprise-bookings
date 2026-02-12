/**
 * Shared request parsing utilities for API routes.
 */

/** Coerce unknown value to Record<string, string> (Stripe metadata, etc.). */
export function coerceMetadata(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === 'string') out[k] = v
  }
  return out
}

/** Parse JSON body from request; returns null on failure. */
export async function parseJsonBody<T = unknown>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T
  } catch {
    return null
  }
}
