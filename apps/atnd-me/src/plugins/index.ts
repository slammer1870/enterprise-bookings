import { formBuilderPlugin } from '@payloadcms/plugin-form-builder'
import { nestedDocsPlugin } from '@payloadcms/plugin-nested-docs'
import { redirectsPlugin } from '@payloadcms/plugin-redirects'
import { seoPlugin } from '@payloadcms/plugin-seo'
import { searchPlugin } from '@payloadcms/plugin-search'
import { multiTenantPlugin } from '@payloadcms/plugin-multi-tenant'
import { sentryPlugin } from '@payloadcms/plugin-sentry'
import { Plugin } from 'payload'
import * as Sentry from '@sentry/nextjs'
import { revalidateRedirects } from '@/hooks/revalidateRedirects'
import { GenerateTitle, GenerateURL } from '@payloadcms/plugin-seo/types'
import { FixedToolbarFeature, HeadingFeature, lexicalEditor } from '@payloadcms/richtext-lexical'
import { searchFields } from '@/search/fieldOverrides'
import { beforeSyncWithSearch } from '@/search/beforeSync'
import { rolesPlugin } from '@repo/roles'
import { checkRole } from '@repo/shared-utils'
import type { User as SharedUser } from '@repo/shared-types'
import { filterSchedulerGlobal } from './filter-scheduler-global'
import { requireStripeConnectForPayments } from '@/hooks/requireStripeConnectForPayments'
import { bookingsPlugin } from '@repo/bookings-plugin'
import {
  tenantScopedCreate,
  tenantScopedUpdate,
  tenantScopedDelete,
  tenantScopedReadFiltered,
} from '../access/tenant-scoped'
import {
  bookingCreateAccessWithPaymentValidation,
  bookingUpdateAccessWithPaymentValidation,
} from '../access/bookingAccess'
import { calculateBookingFeeAmount } from '@/lib/stripe-connect/bookingFee'
import {
  bookingsPaymentsPlugin,
  createDecrementClassPassHook,
  getClassPassIdFromBookingTransaction,
  createBookingTransactionOnCreate,
} from '@repo/bookings-payments'
import { payloadAuth } from './better-auth'
import { fixBetterAuthTimestamps } from '@repo/better-auth-config/fix-better-auth-timestamps'
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
      admin: { group: 'Website' },
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
      admin: { group: 'Website' },
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
  // Payload Sentry plugin: captures Payload API/admin/hooks errors and sends to Sentry.
  // Requires Sentry Next.js setup (sentry.client/server.config) and SENTRY_DSN in production.
  sentryPlugin({
    Sentry
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
      fields: ({ defaultFields }) => [
        ...defaultFields,
        {
          name: 'paymentMethods',
          type: 'group',
          label: 'Payment Methods',
          admin: {
            description:
              'Configure how customers can pay for this class option. Add a drop-in price, allowed class pass types, or membership plans. Connect Stripe to enable payments.',
            components: {
              Field: '@/components/admin/RequireStripeConnectField',
            },
          },
          fields: [
            // allowedDropIn, allowedClassPasses, allowedPlans injected by @repo/bookings-payments
          ],
        },
      ],
      hooks: ({ defaultHooks }) => {
        const d = defaultHooks as Record<string, unknown>
        return {
          ...defaultHooks,
          beforeChange: [...(Array.isArray(d?.beforeChange) ? d.beforeChange : []), requireStripeConnectForPayments],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- plugin HooksConfig omits beforeChange
        } as any
      },
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
      fields: ({ defaultFields }) => [
        ...defaultFields,
        {
          name: 'paymentMethodUsed',
          type: 'select',
          label: 'Payment method (set at create)',
          options: [
            { label: 'Stripe', value: 'stripe' },
            { label: 'Class pass', value: 'class_pass' },
            { label: 'Subscription', value: 'subscription' },
          ],
          required: false,
          admin: { description: 'Set by API when creating; used to create a booking-transaction. Hidden from normal create flow.' },
        },
        {
          name: 'classPassIdUsed',
          type: 'number',
          label: 'Class pass id (set at create)',
          required: false,
          admin: {
            description: 'Set when paymentMethodUsed is class_pass; used to decrement the correct pass.',
            condition: (_: unknown, sibling: { paymentMethodUsed?: string }) =>
              sibling?.paymentMethodUsed === 'class_pass',
          },
        },
        {
          name: 'subscriptionIdUsed',
          type: 'number',
          label: 'Subscription id (set at create)',
          required: false,
          admin: {
            description: 'Set when paymentMethodUsed is subscription; used to create a booking-transaction referencing the subscription.',
            condition: (_: unknown, sibling: { paymentMethodUsed?: string }) =>
              sibling?.paymentMethodUsed === 'subscription',
          },
        },
      ],
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
        afterChange: [
          ...(defaultHooks.afterChange || []),
          createBookingTransactionOnCreate(),
          createDecrementClassPassHook({
            getClassPassIdToDecrement: getClassPassIdFromBookingTransaction(),
          }),
        ],
      }),
      access: ({ defaultAccess }) => ({
        ...defaultAccess,
        read: tenantScopedReadFiltered, // Filter by tenant for tenant-admins
        create: bookingCreateAccessWithPaymentValidation, // Step 3: payment validation (Connect required when payments enabled)
        update: bookingUpdateAccessWithPaymentValidation,
      }),
    },
  }),
  // Payments features from @repo/bookings-payments; tenant-scoped access for multi-tenant
  bookingsPaymentsPlugin({
    classPass: {
      enabled: true,
      classOptionsSlug: 'class-options',
      bookingTransactionsOverrides: {
        access: {
          read: tenantScopedReadFiltered,
          create: tenantScopedCreate,
          update: tenantScopedUpdate,
          delete: tenantScopedDelete,
        },
      },
      classPassesOverrides: {
        access: {
          read: tenantScopedReadFiltered,
          create: tenantScopedCreate,
          update: tenantScopedUpdate,
          delete: tenantScopedDelete,
        },
      },
      classPassTypesOverrides: {
        access: {
          read: tenantScopedReadFiltered,
          create: tenantScopedCreate,
          update: tenantScopedUpdate,
          delete: tenantScopedDelete,
        },
      },
    },
    // Drop-ins: single-use payment options per class option
    dropIns: {
      enabled: true,
      paymentMethodSlugs: ['class-options'],
      acceptedPaymentMethods: ['cash', 'card'],
      dropInsOverrides: {
        access: {
          read: tenantScopedReadFiltered,
          create: tenantScopedCreate,
          update: tenantScopedUpdate,
          delete: tenantScopedDelete,
        },
      },
    },
    // Membership (subscriptions): recurring plans that grant access
    membership: {
      enabled: true,
      paymentMethodSlugs: ['class-options'],
      getSubscriptionBookingFeeCents: async ({
        payload,
        tenantId,
        classPriceAmountCents,
      }) => {
        return calculateBookingFeeAmount({
          payload,
          tenantId,
          productType: 'subscription',
          classPriceAmount: classPriceAmountCents,
        })
      },
    },
  }),
  // Must run after formBuilderPlugin to add tenant scoping hook to form-submissions
  tenantScopeFormSubmissions(),
  // Multi-tenant plugin must come AFTER bookingsPlugin so it can see the collections it creates
  multiTenantPlugin({
    tenantsSlug: 'tenants',
    cleanupAfterTenantDelete: false,
    // Opt out of baseListFilter on users so admins see all users (including themselves)
    // when a tenant is selected. Our userTenantRead access already enforces admin/tenant-admin rules.
    useUsersTenantFilter: true,
    // Configure admin users to have access to all tenants
    userHasAccessToAllTenants: (user) => {
      if (!user) return false
      return checkRole(['admin'], user as unknown as SharedUser)
    },
    // Type assertion: multi-tenant plugin's types omit collections from @repo/bookings-payments
    collections: {
      // Standard collections
      pages: {},
      lessons: {},
      instructors: {},
      'class-options': {},
      bookings: {}, // Tenant-scoped for tracking which tenant bookings belong to
      // From @repo/bookings-payments
      'class-pass-types': {}, // Pass types (e.g. Fitness Only, Sauna Only); tenant-scoped
      'class-passes': {}, // Class passes; tenant-scoped
      'transactions': {}, // Payment records per booking (Stripe, class pass, subscription); tenant-scoped via plugin overrides
      'drop-ins': {}, // Drop-in payment options; tenant-scoped
      plans: {}, // Membership plans (collection slug: plans); tenant-scoped
      subscriptions: {}, // User subscriptions; tenant-scoped
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
    } as Parameters<typeof multiTenantPlugin>[0]['collections'],
  }),
  // Filter out the scheduler global that bookingsPlugin adds (we use a collection instead)
  filterSchedulerGlobal,
]
