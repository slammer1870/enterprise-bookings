import type { Field } from 'payload'

type TenantScopedCollection = 'pages' | 'posts'

function docLabel(collection: TenantScopedCollection): string {
  return collection === 'posts' ? 'post' : 'page'
}

/**
 * Slug unique per tenant (or globally when tenant is null for platform/root content).
 */
export function tenantScopedSlugField({
  fieldToUse = 'title',
  collection = 'pages',
}: {
  fieldToUse?: string
  collection?: TenantScopedCollection
} = {}): Field {
  const label = docLabel(collection)

  return {
    name: 'slug',
    type: 'text',
    required: true,
    index: true,
    admin: {
      position: 'sidebar',
    },
    hooks: {
      beforeValidate: [
        async ({ data, operation, req: _req, value }) => {
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
        async ({ data, operation, req, value, originalDoc }) => {
          if (!value) return value

          let tenantId: string | number | null = null

          if (data?.tenant) {
            tenantId =
              typeof data.tenant === 'object' && data.tenant !== null && 'id' in data.tenant
                ? (data.tenant as { id: string | number }).id
                : data.tenant
          }

          if (!tenantId && operation === 'update' && originalDoc?.tenant) {
            tenantId =
              typeof originalDoc.tenant === 'object' &&
              originalDoc.tenant !== null &&
              'id' in originalDoc.tenant
                ? (originalDoc.tenant as { id: string | number }).id
                : originalDoc.tenant
          }

          if (!tenantId && req.context?.tenant) {
            const rawTenant = req.context.tenant
            if (typeof rawTenant === 'string' || typeof rawTenant === 'number') {
              tenantId = rawTenant
            } else if (typeof rawTenant === 'object' && rawTenant !== null && 'id' in rawTenant) {
              tenantId = (rawTenant as { id: string | number }).id
            }
          }

          const tenantClause =
            tenantId != null ? { tenant: { equals: tenantId } } : { tenant: { equals: null } }

          const currentDocId =
            operation === 'update' && originalDoc?.id ? originalDoc.id : null

          const existing = await req.payload.find({
            collection,
            where: {
              and: [
                { slug: { equals: value } },
                tenantClause,
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

          if (existing.docs.length > 0) {
            throw new Error(
              `A ${label} with the slug "${value}" already exists for this site. Please choose a different slug.`,
            )
          }

          return value
        },
      ],
    },
  }
}
