import type { CollectionBeforeValidateHook } from 'payload'

function relationId(value: unknown): number | null {
  if (value == null || value === '') return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && /^\d+$/.test(value)) return parseInt(value, 10)
  if (typeof value === 'object' && value !== null && 'id' in value) {
    const id = (value as { id: unknown }).id
    if (typeof id === 'number' && Number.isFinite(id)) return id
    if (typeof id === 'string' && /^\d+$/.test(id)) return parseInt(id, 10)
  }
  return null
}

/**
 * Ensures `timeslots.branch` (→ `locations`) belongs to the same tenant as the timeslot,
 * and requires `branch` to be set on create when the tenant has more than one active location.
 * UI filterOptions scopes the picker; this hook blocks forged Local API payloads.
 */
export const validateTimeslotBranchMatchesTenant: CollectionBeforeValidateHook = async ({
  data,
  req,
  originalDoc,
  operation,
}) => {
  if (!data) return data

  const branchId = relationId(
    data.branch !== undefined ? data.branch : originalDoc?.branch,
  )
  const tenantId = relationId(
    data.tenant !== undefined ? data.tenant : originalDoc?.tenant,
  )

  // When a branch IS provided: validate it belongs to the same tenant.
  if (branchId != null) {
    if (tenantId == null) {
      throw new Error('A timeslot must have a tenant when a branch is selected.')
    }

    const loc = await req.payload.findByID({
      collection: 'locations',
      id: branchId,
      depth: 0,
      overrideAccess: true,
    })
    if (!loc) {
      throw new Error('Selected branch was not found.')
    }

    const locTenantId = relationId(loc.tenant)
    if (locTenantId !== tenantId) {
      throw new Error('Branch must belong to the same tenant as this timeslot.')
    }
  }

  // On CREATE: require branch when the tenant has more than one active location.
  // Without this, timeslots would be invisible to end-users who browse by location.
  if (operation === 'create' && branchId == null && tenantId != null) {
    const locs = await req.payload.find({
      collection: 'locations',
      where: {
        and: [
          { tenant: { equals: tenantId } },
          { active: { equals: true } },
        ],
      },
      limit: 2,
      depth: 0,
      overrideAccess: true,
    })
    if (locs.totalDocs > 1) {
      throw new Error(
        'A branch must be selected when the tenant has more than one active site.',
      )
    }
  }

  return data
}
