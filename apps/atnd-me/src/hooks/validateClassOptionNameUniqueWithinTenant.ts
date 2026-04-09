import type { CollectionBeforeValidateHook } from 'payload'

/**
 * Validates that the class option name is unique within the tenant (not globally).
 * Used with tenant-scoped class options; allows the same name across different tenants.
 */
export const validateClassOptionNameUniqueWithinTenant: CollectionBeforeValidateHook = async ({
  data,
  req,
  operation,
  originalDoc,
}) => {
  const name = data?.name
  if (!name || typeof name !== 'string' || !name.trim()) return data

  let tenantId: string | number | null = null

  if (data?.tenant) {
    tenantId =
      typeof data.tenant === 'object' && data.tenant !== null && 'id' in data.tenant
        ? (data.tenant as { id: string | number }).id
        : (data.tenant as string | number)
  }
  if (!tenantId && operation === 'update' && originalDoc?.tenant) {
    tenantId =
      typeof originalDoc.tenant === 'object' && originalDoc.tenant !== null && 'id' in originalDoc.tenant
        ? (originalDoc.tenant as { id: string | number }).id
        : (originalDoc.tenant as string | number)
  }
  if (!tenantId && req.context?.tenant) {
    const rawTenant = req.context.tenant
    tenantId =
      typeof rawTenant === 'string' || typeof rawTenant === 'number'
        ? rawTenant
        : typeof rawTenant === 'object' && rawTenant !== null && 'id' in rawTenant
          ? (rawTenant as { id: string | number }).id
          : null
  }

  if (!tenantId) return data

  const currentDocId = operation === 'update' && originalDoc?.id ? originalDoc.id : null

  const existing = await req.payload.find({
    collection: 'event-types',
    where: {
      and: [
        { name: { equals: name.trim() } },
        { tenant: { equals: tenantId } },
        ...(currentDocId ? [{ id: { not_equals: currentDocId } }] : []),
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    select: { id: true } as any,
  })

  if (existing.docs.length > 0) {
    throw new Error(
      `A class option named "${name}" already exists for this tenant. Names must be unique within each location.`,
    )
  }

  return data
}
