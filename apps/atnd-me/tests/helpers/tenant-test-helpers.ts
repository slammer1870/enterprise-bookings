import type { Payload } from 'payload'

// TODO: flesh these helpers out as multi-tenant implementation progresses.

export async function createTestTenant(_payload: Payload) {
  // Placeholder for future tenant creation logic in tests
  // e.g. return await payload.create({ collection: 'tenants', data: { ... } })
  return null
}

export async function createTestUserWithTenant(_payload: Payload) {
  // Placeholder for future user + tenant assignment helper
  return null
}

export function setTenantContext() {
  // Placeholder for test helper to set tenant context on requests
}

export function getTenantFromSubdomain(hostname: string | null): string | null {
  if (!hostname) return null
  const parts = hostname.split('.')
  if (parts.length < 3) return null

  const subdomain = parts[0] ?? null
  return subdomain
}

