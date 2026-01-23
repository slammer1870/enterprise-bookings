import { formBuilderPlugin } from '@payloadcms/plugin-form-builder'
import { nestedDocsPlugin } from '@payloadcms/plugin-nested-docs'
import { redirectsPlugin } from '@payloadcms/plugin-redirects'
import { seoPlugin } from '@payloadcms/plugin-seo'
import { searchPlugin } from '@payloadcms/plugin-search'
import { multiTenantPlugin } from '@payloadcms/plugin-multi-tenant'
import { Plugin } from 'payload'
import { revalidateRedirects } from '@/hooks/revalidateRedirects'
import { GenerateTitle, GenerateURL } from '@payloadcms/plugin-seo/types'
import { FixedToolbarFeature, HeadingFeature, lexicalEditor } from '@payloadcms/richtext-lexical'
import { searchFields } from '@/search/fieldOverrides'
import { beforeSyncWithSearch } from '@/search/beforeSync'
import { rolesPlugin } from '@repo/roles'
import { checkRole } from '@repo/shared-utils'
import type { User as SharedUser } from '@repo/shared-types'
import { filterSchedulerGlobal } from './filter-scheduler-global'
import { bookingsPlugin } from '@repo/bookings-plugin'
import {
  tenantScopedCreate,
  tenantScopedUpdate,
  tenantScopedDelete,
  tenantScopedReadFiltered,
} from '../access/tenant-scoped'
import { payloadAuth } from './better-auth'
import { fixBetterAuthTimestamps } from './fix-better-auth-accounts-timestamps'
import { fixBetterAuthRoleField } from './fix-better-auth-role-field'
import { tenantScopeFormSubmissions } from './tenant-scope-form-submissions'

import { Page, Post } from '@/payload-types'
import { getServerSideURL } from '@/utilities/getURL'

const generateTitle: GenerateTitle<Post | Page> = ({ doc }) => {
  return doc?.title ? `${doc.title} | Payload Website Template` : 'Payload Website Template'
}

const generateURL: GenerateURL<Post | Page> = ({ doc }) => {
  const url = getServerSideURL()

  return doc?.slug ? `${url}/${doc.slug}` : url
}

export const plugins: Plugin[] = [
  redirectsPlugin({
    collections: ['pages', 'posts'],
    overrides: {
      // @ts-expect-error - This is a valid override, mapped fields don't resolve to the same type
      fields: ({ defaultFields }) => {
        return defaultFields.map((field) => {
          if ('name' in field && field.name === 'from') {
            return {
              ...field,
              admin: {
                description: 'You will need to rebuild the website when changing this field.',
              },
            }
          }
          return field
        })
      },
      hooks: {
        afterChange: [revalidateRedirects],
      },
    },
  }),
  nestedDocsPlugin({
    collections: ['categories'],
    generateURL: (docs) => docs.reduce((url, doc) => `${url}/${doc.slug}`, ''),
  }),
  seoPlugin({
    generateTitle,
    generateURL,
  }),
  formBuilderPlugin({
    fields: {
      payment: false,
    },
    formOverrides: {
      fields: ({ defaultFields }) => {
        return defaultFields.map((field) => {
          if ('name' in field && field.name === 'confirmationMessage') {
            return {
              ...field,
              editor: lexicalEditor({
                features: ({ rootFeatures }) => {
                  return [
                    ...rootFeatures,
                    FixedToolbarFeature(),
                    HeadingFeature({ enabledHeadingSizes: ['h1', 'h2', 'h3', 'h4'] }),
                  ]
                },
              }),
            }
          }
          return field
        })
      },
      access: {
        read: tenantScopedReadFiltered,
        create: tenantScopedCreate,
        update: tenantScopedUpdate,
        delete: tenantScopedDelete,
      },
    },
    formSubmissionOverrides: {
      access: {
        read: tenantScopedReadFiltered,
        create: () => true, // Allow public form submissions
        update: tenantScopedUpdate,
        delete: tenantScopedDelete,
      },
    },
  }),
  searchPlugin({
    collections: ['posts'],
    beforeSync: beforeSyncWithSearch,
    searchOverrides: {
      fields: ({ defaultFields }) => {
        return [...defaultFields, ...searchFields]
      },
    },
  }),
  payloadAuth(),
  // Must run after `payloadAuth()` so the Better Auth collections exist.
  fixBetterAuthTimestamps(),
  rolesPlugin({
    enabled: true,
    roles: ['user', 'admin', 'tenant-admin'],
    defaultRole: 'user',
    firstUserRole: 'admin',
  }),
  // Must run after both payloadAuth() and rolesPlugin() to sync role/roles fields
  fixBetterAuthRoleField(),
  bookingsPlugin({
    enabled: true,
    lessonOverrides: {
      access: ({ defaultAccess }) => ({
        ...defaultAccess,
        read: tenantScopedReadFiltered, // Filter by tenant for tenant-admins, public for booking
        create: tenantScopedCreate,
        update: tenantScopedUpdate,
        delete: tenantScopedDelete,
      }),
    },
    classOptionsOverrides: {
      access: ({ defaultAccess }) => ({
        ...defaultAccess,
        read: () => true, // Public read for booking pages
        create: tenantScopedCreate,
        update: tenantScopedUpdate,
        delete: tenantScopedDelete,
      }),
    },
    instructorOverrides: {
      access: ({ defaultAccess }) => ({
        ...defaultAccess,
        read: () => true, // Public read for booking pages
        create: tenantScopedCreate,
        update: tenantScopedUpdate,
        delete: tenantScopedDelete,
      }),
    },
    bookingOverrides: {
      hooks: ({ defaultHooks }) => ({
        ...defaultHooks,
        beforeValidate: [
          ...(defaultHooks.beforeValidate || []),
          // Auto-set tenant from lesson for multi-tenant support
          async ({ req, data, operation }) => {
            if (operation === 'create' && data?.lesson && !data?.tenant) {
              const lessonId = typeof data.lesson === 'object' ? data.lesson.id : data.lesson
              const lesson = await req.payload.findByID({
                collection: 'lessons',
                id: lessonId,
                depth: 0,
              })
              if (lesson?.tenant) {
                // Normalize tenant to ID (number) - lesson.tenant can be object or number
                const tenantId = typeof lesson.tenant === 'object' && lesson.tenant !== null
                  ? lesson.tenant.id
                  : lesson.tenant
                if (tenantId) {
                  data.tenant = tenantId
                }
              }
            }
            return data
          },
        ],
      }),
      access: ({ defaultAccess }) => ({
        ...defaultAccess,
        // Bookings access is already handled by bookingCreateAccess/bookingUpdateAccess
        // which checks lesson availability, so we keep the default access
        read: tenantScopedReadFiltered, // Filter by tenant for tenant-admins
      }),
    },
  }),
  // Must run after formBuilderPlugin to add tenant scoping hook to form-submissions
  tenantScopeFormSubmissions(),
  // Multi-tenant plugin must come AFTER bookingsPlugin so it can see the collections it creates
  multiTenantPlugin({
    tenantsSlug: 'tenants',
    cleanupAfterTenantDelete: false,
    // Configure admin users to have access to all tenants
    userHasAccessToAllTenants: (user) => {
      if (!user) return false
      return checkRole(['admin'], user as unknown as SharedUser)
    },
    collections: {
      // Standard collections
      pages: {},
      lessons: {},
      instructors: {},
      'class-options': {},
      bookings: {}, // Tenant-scoped for tracking which tenant bookings belong to
      forms: {}, // Tenant-scoped for forms
      'form-submissions': {}, // Tenant-scoped for form submissions
      // Globals converted to collections (one per tenant)
      // Using isGlobal: true enforces single document per tenant
      navbar: { isGlobal: true },
      footer: { isGlobal: true },
      scheduler: { isGlobal: true },
      // NOTE: users collection is NOT included here to avoid automatic tenant scoping
      // The plugin will still add a 'tenants' field (array) to users automatically
      // We use:
      // - registrationTenant (custom, singular): where user originally registered
      // - tenants (plugin-managed, plural): tenants user has access to
    },
  }),
  // Filter out the scheduler global that bookingsPlugin adds (we use a collection instead)
  filterSchedulerGlobal,
]
