import { APIError, type Field } from 'payload'

import { formatDocumentSlug, normalizeAndValidateDocumentSlug } from '@/utilities/documentSlug'

type TenantScopedCollection = 'pages' | 'posts'

function docLabel(collection: TenantScopedCollection): string {
  return collection === 'posts' ? 'post' : 'page'
}

/**
 * Slug unique per tenant (or globally when tenant is null for platform/root content).
 * Formats to a URL-safe path segment when a value (or create-time title) is present.
 * Empty values are left alone so create/draft form hydration is not blocked.
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
      description:
        'URL path for this page. Saved as lowercase letters, numbers, and hyphens only.',
    },
    validate: (value: unknown) => {
      // Allow empty here — `required` + beforeValidate cover real saves; drafts/create
      // hydration often hit validate with an empty slug before the editor fills it in.
      if (value == null || (typeof value === 'string' && !value.trim())) return true
      const result = normalizeAndValidateDocumentSlug(value)
      return result.ok ? true : result.error
    },
    hooks: {
      beforeValidate: [
        async ({ data, operation, value }) => {
          const hasValue = typeof value === 'string' && value.trim().length > 0

          if (!hasValue) {
            if (operation === 'create' && data?.[fieldToUse]) {
              const fromTitle = formatDocumentSlug(String(data[fieldToUse]))
              // Title may still be empty/unusable during form hydration — don't throw.
              return fromTitle || value
            }
            return value
          }

          const result = normalizeAndValidateDocumentSlug(value)
          if (!result.ok) {
            throw new APIError(result.error, 400)
          }
          return result.slug
        },
        async ({ data, operation, req, value, originalDoc }) => {
          if (!value || (typeof value === 'string' && !value.trim())) return value

          const result = normalizeAndValidateDocumentSlug(value)
          if (!result.ok) {
            throw new APIError(result.error, 400)
          }
          const formatted = result.slug

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
                { slug: { equals: formatted } },
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
            throw new APIError(
              `A ${label} with the slug "${formatted}" already exists for this site. Please choose a different slug.`,
              400,
            )
          }

          return formatted
        },
      ],
    },
  }
}
