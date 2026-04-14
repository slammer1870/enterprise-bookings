import type { CollectionConfig } from 'payload'

import { link } from '@/fields/link'
import type { User as SharedUser } from '@repo/shared-types'
import { getUserTenantIds } from '../../access/tenant-scoped'
import { revalidateFooter } from './hooks/revalidateFooter'
import { syncPublicMediaFlags } from '@/utilities/syncPublicMedia'
import { getRequestHostname, getTenantSlugFromRequest, isBaseHostRequest } from '@/utilities/tenantRequest'
import {
  tenantScopedCreate,
  tenantScopedUpdate,
  tenantScopedDelete,
} from '../../access/tenant-scoped'
import { isStaffOnlyUser, tenantOrgPayloadAdminAccess } from '../../access/userTenantAccess'

// Multi-tenant Footer collection (converted from Footer global)
// Each tenant has one footer document. One document with no tenant is used as the root site footer (when no tenant is assigned, e.g. root domain).
export const Footer: CollectionConfig = {
  slug: 'footer',
  admin: {
    useAsTitle: 'tenant',
    defaultColumns: ['tenant', 'logoLink', 'updatedAt'],
    group: 'Website',
    description:
      'Footer per tenant. To show a footer when no tenant is assigned (root domain), create one document and leave Tenant empty (admin only).',
  },
  access: {
    admin: tenantOrgPayloadAdminAccess,
    read: () => true, // Public read for frontend rendering
    create: async (args) => {
      if (isStaffOnlyUser(args.req.user)) return false
      return tenantScopedCreate(args)
    },
    update: async (args) => {
      if (isStaffOnlyUser(args.req.user)) return false
      return tenantScopedUpdate(args)
    },
    delete: async (args) => {
      if (isStaffOnlyUser(args.req.user)) return false
      return tenantScopedDelete(args)
    },
  },
  fields: [
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: false,
      admin: {
        position: 'sidebar',
        hidden: true,
        description:
          'Optional. Leave empty for the root site footer (when no tenant is assigned, e.g. root domain).',
      },
      filterOptions: ({ req }) => {
        const tenantIds = getUserTenantIds((req.user ?? null) as unknown as SharedUser | null)
        if (tenantIds === null) return true
        if (Array.isArray(tenantIds) && tenantIds.length > 0) {
          return { id: { in: tenantIds } }
        }
        return true
      },
    },
    {
      name: '_tenantSelectorSync',
      type: 'ui',
      admin: {
        position: 'sidebar',
        components: {
          Field: '@repo/plugin-clearable-tenant/client#SyncTenantSelectorToFormField',
        },
      },
    },
    {
      name: 'logo',
      type: 'upload',
      relationTo: 'media',
      label: 'Logo',
      admin: {
        description: 'Custom logo for this site. If not set, default logo will be used.',
        position: 'sidebar',
      },
    },
    {
      name: 'logoLink',
      type: 'text',
      label: 'Logo Link URL',
      admin: {
        description: 'URL the logo should link to (defaults to "/")',
        position: 'sidebar',
      },
      defaultValue: '/',
    },
    {
      name: 'copyrightText',
      type: 'text',
      label: 'Copyright Text',
      admin: {
        description: 'Copyright notice to display in footer',
        position: 'sidebar',
      },
    },
    {
      name: 'navItems',
      type: 'array',
      label: 'Navigation Items',
      fields: [
        link({
          appearances: false,
          publishedOnly: true,
        }),
        {
          name: 'icon',
          type: 'select',
          label: 'Icon',
          options: [
            { label: 'None', value: 'none' },
            { label: 'Instagram', value: 'instagram' },
            { label: 'Facebook', value: 'facebook' },
            { label: 'X (Twitter)', value: 'x' },
            { label: 'Location', value: 'location' },
          ],
          defaultValue: 'none',
          admin: {
            description: 'Optional icon before the label (e.g. for social links).',
          },
        },
      ],
      maxRows: 10,
      admin: {
        initCollapsed: true,
        components: {
          RowLabel: '@/Footer/RowLabel#RowLabel',
        },
      },
    },
    {
      name: 'styling',
      type: 'group',
      label: 'Styling Options',
      fields: [
        {
          name: 'backgroundColor',
          type: 'text',
          label: 'Background Color',
          admin: {
            description: 'CSS color value (e.g., "#000000", "var(--background)")',
          },
        },
        {
          name: 'textColor',
          type: 'text',
          label: 'Text Color',
          admin: {
            description: 'CSS color value for text',
          },
        },
        {
          name: 'showThemeSelector',
          type: 'checkbox',
          label: 'Show Theme Selector',
          defaultValue: true,
          admin: {
            description: 'Display theme selector in footer',
          },
        },
        {
          name: 'padding',
          type: 'select',
          label: 'Padding',
          options: [
            { label: 'Small', value: 'small' },
            { label: 'Medium', value: 'medium' },
            { label: 'Large', value: 'large' },
          ],
          defaultValue: 'medium',
          admin: {
            description: 'Match navbar padding so edges align',
          },
        },
      ],
    },
  ],
  hooks: {
    beforeValidate: [
      async ({ data, operation, req }) => {
        // Set tenant from context on create only when not explicitly set (allow null for root footer)
        if (operation === 'create' && data && (data.tenant === undefined || data.tenant === null)) {
          const rawTenant = req.context?.tenant as unknown
          if (rawTenant) {
            // `tenant` may be a primitive ID or an object with an `id` field
            data.tenant =
              typeof rawTenant === 'object' && rawTenant !== null && 'id' in rawTenant
                ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (rawTenant as any).id
                : (rawTenant as string | number)
          } else {
            // Fallback: on tenant subdomains, tenant selector may default to "no tenant" (null).
            // Use the tenant-slug cookie set by middleware to resolve the tenant id.
            const requestHost = getRequestHostname(req.headers)
            const isTenantHost = Boolean(requestHost) && !isBaseHostRequest(req.headers)

            if (isTenantHost) {
              const slug = getTenantSlugFromRequest({ headers: req.headers })?.toLowerCase() ?? null
              if (slug && /^[a-z0-9-]+$/.test(slug)) {
                try {
                  const result = await req.payload.find({
                    collection: 'tenants',
                    where: { slug: { equals: slug } },
                    limit: 1,
                    depth: 0,
                    overrideAccess: true,
                    req,
                  })
                  const tenant = result.docs[0] as { id?: unknown } | undefined
                  const id = tenant?.id
                  if (typeof id === 'string' || typeof id === 'number') {
                    data.tenant = id
                  }
                } catch {
                  // Leave tenant unset on lookup error
                }
              }
            }
          }
        }
        return data
      },
    ],
    afterChange: [
      revalidateFooter,
      async ({ req }) => {
        await syncPublicMediaFlags(req)
      },
    ],
    afterDelete: [
      async ({ req }) => {
        await syncPublicMediaFlags(req)
      },
    ],
  },
  timestamps: true,
}
