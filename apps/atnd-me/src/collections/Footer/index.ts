import type { CollectionConfig } from 'payload'

import { link } from '@/fields/link'
import { getUserTenantIds } from '../../access/tenant-scoped'
import { revalidateFooter } from './hooks/revalidateFooter'
import {
  tenantScopedCreate,
  tenantScopedUpdate,
  tenantScopedDelete,
} from '../../access/tenant-scoped'

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
    read: () => true, // Public read for frontend rendering
    create: tenantScopedCreate,
    update: tenantScopedUpdate,
    delete: tenantScopedDelete,
  },
  fields: [
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: false,
      admin: {
        position: 'sidebar',
        description:
          'Optional. Leave empty for the root site footer (when no tenant is assigned, e.g. root domain).',
      },
      filterOptions: ({ req }) => {
        const tenantIds = getUserTenantIds((req as any)?.user ?? null)
        if (tenantIds === null) return true
        if (Array.isArray(tenantIds) && tenantIds.length > 0) {
          return { id: { in: tenantIds } }
        }
        return true
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
        }),
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
      ],
    },
  ],
  hooks: {
    beforeValidate: [
      async ({ data, operation, req }) => {
        // Set tenant from context on create only when not explicitly set (allow null for root footer)
        if (operation === 'create' && data && data.tenant === undefined) {
          const rawTenant = req.context?.tenant as unknown
          if (rawTenant) {
            // `tenant` may be a primitive ID or an object with an `id` field
            data.tenant =
              typeof rawTenant === 'object' && 'id' in rawTenant
                ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (rawTenant as any).id
                : (rawTenant as string | number)
          }
        }
        return data
      },
    ],
    afterChange: [revalidateFooter],
  },
  timestamps: true,
}
