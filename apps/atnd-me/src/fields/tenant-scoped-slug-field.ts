import type { Field } from 'payload'

/**
 * Creates a slug field that is unique per tenant (not globally unique).
 * 
 * This field:
 * - Auto-generates from the title field if slug is not provided
 * - Validates uniqueness within the tenant context via beforeValidate hook
 * - Does NOT use `unique: true` since we use a composite unique index (tenant_id, slug)
 * 
 * @param options - Configuration options
 * @param options.fieldToUse - Field name to use for auto-generation (default: 'title')
 * @returns A field configuration for tenant-scoped slug
 */
export function tenantScopedSlugField({
  fieldToUse = 'title',
}: {
  fieldToUse?: string
} = {}): Field {
  return {
    name: 'slug',
    type: 'text',
    required: true,
    index: true,
    // Note: We don't use `unique: true` here because we use a composite unique index
    // (tenant_id, slug) in the database to enforce tenant-scoped uniqueness
    admin: {
      position: 'sidebar',
    },
    hooks: {
      beforeValidate: [
        async ({ data, operation, req, value }) => {
          // Auto-generate slug from title if not provided
          if (operation === 'create' && !value && data?.[fieldToUse]) {
            const title = data[fieldToUse] as string
            if (title) {
              return title
                .toLowerCase()
                .trim()
                .replace(/[^\w\s-]/g, '')
                .replace(/[\s_-]+/g, '-')
                .replace(/^-+|-+$/g, '')
            }
          }
          return value
        },
        // Validate uniqueness within tenant
        async ({ data, operation, req, value, originalDoc }) => {
          if (!value) return value

          // Get tenant ID from data or context
          let tenantId: string | number | null = null
          
          // Try to get tenant from data first
          if (data?.tenant) {
            tenantId = typeof data.tenant === 'object' && data.tenant !== null && 'id' in data.tenant
              ? (data.tenant as { id: string | number }).id
              : data.tenant
          }
          
          // Fallback to originalDoc for update operations
          if (!tenantId && operation === 'update' && originalDoc?.tenant) {
            tenantId = typeof originalDoc.tenant === 'object' && originalDoc.tenant !== null && 'id' in originalDoc.tenant
              ? (originalDoc.tenant as { id: string | number }).id
              : originalDoc.tenant
          }
          
          // Fallback to context (set by multi-tenant plugin)
          if (!tenantId && req.context?.tenant) {
            const rawTenant = req.context.tenant
            if (typeof rawTenant === 'string' || typeof rawTenant === 'number') {
              tenantId = rawTenant
            } else if (typeof rawTenant === 'object' && rawTenant !== null && 'id' in rawTenant) {
              tenantId = (rawTenant as { id: string | number }).id
            }
          }

          // If no tenant context, we can't validate - let the database constraint handle it
          if (!tenantId) {
            return value
          }

          // Get current document ID for update operations
          const currentDocId = operation === 'update' && originalDoc?.id
            ? originalDoc.id
            : null

          // Check if slug already exists for this tenant
          const existingPage = await req.payload.find({
            collection: 'pages',
            where: {
              and: [
                {
                  slug: {
                    equals: value,
                  },
                },
                {
                  tenant: {
                    equals: tenantId,
                  },
                },
                // Exclude current document if updating
                ...(currentDocId
                  ? [
                      {
                        id: {
                          not_equals: currentDocId,
                        },
                      },
                    ]
                  : []),
              ],
            },
            limit: 1,
            depth: 0,
            overrideAccess: true,
          })

          if (existingPage.docs.length > 0) {
            throw new Error(
              `A page with the slug "${value}" already exists for this tenant. Please choose a different slug.`
            )
          }

          return value
        },
      ],
    },
  }
}
