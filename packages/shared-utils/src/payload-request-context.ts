/**
 * Keys and helpers for Payload `req.context` request-scoped caches.
 * Used to dedupe tenant slug/domain DB lookups and admin membership resolution.
 */

export const PAYLOAD_CTX_CACHED_TENANT_ADMIN_TENANT_IDS =
  "__atndCachedTenantAdminTenantIds" as const;

const LOOKUP_CACHE_KEY = "__atndTenantLookupCache" as const;

function getLookupCache(ctx: Record<string, unknown>): Map<string, number> {
  const existing = ctx[LOOKUP_CACHE_KEY];
  if (existing instanceof Map) {
    return existing as Map<string, number>;
  }
  const m = new Map<string, number>();
  ctx[LOOKUP_CACHE_KEY] = m;
  return m;
}

export function rememberTenantSlugResolution(
  ctx: Record<string, unknown>,
  slug: string,
  tenantId: number,
): void {
  if (!slug || typeof tenantId !== "number" || !Number.isFinite(tenantId)) return;
  getLookupCache(ctx).set(`slug:${slug.trim().toLowerCase()}`, tenantId);
}

export function rememberTenantDomainResolution(
  ctx: Record<string, unknown>,
  normalizedDomain: string,
  tenantId: number,
): void {
  if (!normalizedDomain || typeof tenantId !== "number" || !Number.isFinite(tenantId)) {
    return;
  }
  getLookupCache(ctx).set(`domain:${normalizedDomain}`, tenantId);
}

export function getCachedTenantIdForSlug(
  ctx: Record<string, unknown>,
  slug: string,
): number | undefined {
  if (!slug) return undefined;
  return getLookupCache(ctx).get(`slug:${slug.trim().toLowerCase()}`);
}

export function getCachedTenantIdForDomain(
  ctx: Record<string, unknown>,
  normalizedDomain: string,
): number | undefined {
  if (!normalizedDomain) return undefined;
  return getLookupCache(ctx).get(`domain:${normalizedDomain}`);
}
