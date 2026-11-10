import type { Payload } from 'payload'

import type { BranchLocation } from '@/lib/stripe-connect/branchChargeMetadata'

function locationTenantId(tenant: unknown): number | null {
  if (typeof tenant === 'number' && Number.isFinite(tenant)) return tenant
  if (typeof tenant === 'string' && /^\d+$/.test(tenant)) return parseInt(tenant, 10)
  if (tenant && typeof tenant === 'object' && 'id' in tenant) {
    const id = (tenant as { id?: unknown }).id
    if (typeof id === 'number' && Number.isFinite(id)) return id
  }
  return null
}

/** Numeric id from a locations relationship, whether stored as an id or populated. */
export function branchIdFromRelation(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && /^\d+$/.test(value)) return parseInt(value, 10)
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'number' && Number.isFinite(id)) return id
    if (typeof id === 'string' && /^\d+$/.test(id)) return parseInt(id, 10)
  }
  return null
}

/**
 * Load the location named by a branch id or a populated locations relationship.
 * When tenantId is set, a location from another tenant is treated as unknown.
 */
export async function locationForBranchId(
  payload: Payload,
  branch: unknown,
  tenantId?: number,
): Promise<BranchLocation | null> {
  const branchId = branchIdFromRelation(branch)
  if (branchId == null) return null
  try {
    const location = (await payload.findByID({
      collection: 'locations',
      id: branchId,
      depth: 0,
      overrideAccess: true,
    })) as { name?: unknown; slug?: unknown; tenant?: unknown } | null
    if (!location) return null
    if (tenantId != null && locationTenantId(location.tenant) !== tenantId) return null
    return {
      name: typeof location.name === 'string' ? location.name : '',
      slug: typeof location.slug === 'string' ? location.slug : '',
    }
  } catch {
    return null
  }
}

/** Load the tenant location whose slug is the member's public branch. */
export async function locationForBranchSlug(
  payload: Payload,
  slug: string | null | undefined,
  tenantId: number,
): Promise<(BranchLocation & { id: number }) | null> {
  const clean = typeof slug === 'string' ? slug.trim() : ''
  if (!clean || !Number.isFinite(tenantId)) return null
  try {
    const found = await payload.find({
      collection: 'locations',
      depth: 0,
      limit: 1,
      overrideAccess: true,
      where: {
        and: [{ tenant: { equals: tenantId } }, { slug: { equals: clean } }],
      },
    })
    const location = found.docs[0] as
      | { id?: unknown; name?: unknown; slug?: unknown }
      | undefined
    if (!location || typeof location.id !== 'number') return null
    return {
      id: location.id,
      name: typeof location.name === 'string' ? location.name : '',
      slug: typeof location.slug === 'string' ? location.slug : '',
    }
  } catch {
    return null
  }
}
