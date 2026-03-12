import type { CollectionConfig } from 'payload'

import { link } from '@/fields/link'
import type { User as SharedUser } from '@repo/shared-types'
import { getUserTenantIds } from '../../access/tenant-scoped'
import { revalidateNavbar } from './hooks/revalidateNavbar'
import {
    tenantScopedCreate,
    tenantScopedUpdate,
    tenantScopedDelete,
} from '../../access/tenant-scoped'

// Multi-tenant Navbar collection (converted from Header global)
// Each tenant has one navbar document. One document with no tenant is used as the root site navbar (when no tenant is assigned, e.g. root domain).
export const Navbar: CollectionConfig = {
    slug: 'navbar',
    admin: {
        useAsTitle: 'tenant',
        defaultColumns: ['tenant', 'logoLink', 'updatedAt'],
        group: 'Website',
        description:
            'Navigation bar per tenant. To show a navbar when no tenant is assigned (root domain), create one document and leave Tenant empty (admin only).',
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
                hidden: true,
                description:
                    'Optional. Leave empty for the root site navbar (when no tenant is assigned, e.g. root domain).',
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
            name: 'navItems',
            type: 'array',
            label: 'Navigation Items',
            fields: [
                link({
                    appearances: false,
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
                    ],
                    defaultValue: 'none',
                    admin: {
                        description: 'Optional icon before the label (e.g. for social links).',
                    },
                },
                {
                    name: 'renderAsButton',
                    type: 'checkbox',
                    label: 'Render as Button',
                    defaultValue: false,
                    admin: {
                        description: 'If enabled, this nav item will render as a button instead of a text link.',
                    },
                },
                {
                    name: 'buttonVariant',
                    type: 'select',
                    label: 'Button Variant',
                    options: [
                        { label: 'Default', value: 'default' },
                        { label: 'Outline', value: 'outline' },
                        { label: 'Secondary', value: 'secondary' },
                        { label: 'Ghost', value: 'ghost' },
                    ],
                    defaultValue: 'default',
                    admin: {
                        description: 'Choose which button style to use for this nav item.',
                        condition: (_data, siblingData) => Boolean(siblingData?.renderAsButton),
                    },
                },
            ],
            maxRows: 10,
            admin: {
                initCollapsed: true,
                components: {
                    RowLabel: '@/Header/RowLabel#RowLabel',
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
                        description: 'CSS color value (e.g., "#ffffff", "transparent", "var(--background)")',
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
                    name: 'sticky',
                    type: 'checkbox',
                    label: 'Sticky Header',
                    defaultValue: false,
                    admin: {
                        description: 'Make header stick to top when scrolling',
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
                },
            ],
        },
    ],
    hooks: {
        beforeValidate: [
            async ({ data, operation, req }) => {
                // Set tenant from context on create only when not explicitly set (allow null for root navbar)
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
                        const rootHostname = (() => {
                            const url = process.env.NEXT_PUBLIC_SERVER_URL
                            if (!url) return null
                            try {
                                return new URL(url).hostname
                            } catch {
                                return null
                            }
                        })()

                        const requestHost = req.headers?.get?.('host')?.split(':')[0] ?? ''
                        const isTenantHost =
                            !rootHostname ||
                            (requestHost && rootHostname && requestHost !== rootHostname)

                        if (isTenantHost) {
                            const cookieHeader = req.headers?.get?.('cookie') ?? ''
                            const match = typeof cookieHeader === 'string'
                                ? cookieHeader.match(/(?:^|;\s*)tenant-slug=([^;]*)/)
                                : null
                            const slug = match?.[1] ? decodeURIComponent(match[1]).trim().toLowerCase() : null
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
        afterChange: [revalidateNavbar],
    },
    timestamps: true,
}
