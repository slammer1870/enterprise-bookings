import { formBuilderPlugin } from '@payloadcms/plugin-form-builder'
import { nestedDocsPlugin } from '@payloadcms/plugin-nested-docs'
import { redirectsPlugin } from '@payloadcms/plugin-redirects'
import { seoPlugin } from '@payloadcms/plugin-seo'
import { searchPlugin } from '@payloadcms/plugin-search'
import { multiTenantPlugin } from '@payloadcms/plugin-multi-tenant'
import { sentryPlugin } from '@payloadcms/plugin-sentry'
import type { Field } from 'payload'
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
import { clearableTenantPlugin } from '@repo/plugin-clearable-tenant'
import { requireStripeConnectForPayments } from '@/hooks/requireStripeConnectForPayments'
import { validateClassOptionNameUniqueWithinTenant } from '@/hooks/validateClassOptionNameUniqueWithinTenant'
import { bookingsPlugin } from '@repo/bookings-plugin'
import { lessonsRead } from '@/access/lessonsRead'
import {
  tenantScopedCreate,
  tenantScopedUpdate,
  tenantScopedDelete,
  tenantScopedReadFiltered,
  tenantScopedPublicReadStrict,
} from '../access/tenant-scoped'
import {
  productsRequireStripeConnectRead,
  productsRequireStripeConnectCreate,
  productsRequireStripeConnectUpdate,
  productsRequireStripeConnectDelete,
  productsRequireStripeConnectAdmin,
  adminOnlyFieldAccess,
} from '../access/productsRequireStripeConnect'
import { plansReadWithSoftDelete } from '../access/plansWithSoftDelete'
import { classPassTypesReadWithSoftDelete } from '../access/classPassTypesWithSoftDelete'
import { planAfterChangeSyncToStripe, planBeforeDeleteArchive } from '@/hooks/plansStripeSync'
import {
  classPassTypeAfterChangeSyncToStripe,
  classPassTypeBeforeDeleteArchive,
} from '@/hooks/classPassTypesStripeSync'
import { getStripeAccountIdForRequest } from '@/lib/stripe-connect/getStripeAccountIdForRequest'
import {
  bookingCreateAccessWithPaymentValidation,
  bookingUpdateAccessWithPaymentValidation,
} from '../access/bookingAccess'
import { userTenantRead, userTenantUpdate } from '../access/userTenantAccess'
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
import { hideBetterAuthCollectionsFromTenantAdmins } from './hide-better-auth-collections-from-tenant-admins'
import { hideWebsiteCollectionsFromTenantAdmins } from './hide-website-collections-from-tenant-admins'
import { tenantScopeFormSubmissions } from './tenant-scope-form-submissions'
import { s3Storage } from '@payloadcms/storage-s3'
import { getActiveR2Config } from '@/lib/storage/config'

import { Page, Post, Tenant } from '@/payload-types'
import { getAbsoluteURL, getServerSideURL, getTenantSiteURL } from '@/utilities/getURL'

const generateTitle: GenerateTitle<Post | Page> = ({ doc }) => {
  return doc?.title ? `${doc.title} | ATND` : 'ATND'
}

const generateURL: GenerateURL<Post | Page> = ({ doc }) => {
  const page = doc as Partial<Page>
  const tenant =
    page?.tenant && typeof page.tenant === 'object'
      ? (page.tenant as Tenant)
      : null
  const baseURL = getTenantSiteURL(tenant)
  const isRootPage = page?.slug === 'root' && !tenant
  const isTenantHomePage = page?.slug === 'home' && Boolean(tenant)

  if (isRootPage || isTenantHomePage) {
    return baseURL
  }

  if (doc?.slug) {
    const pathname = 'tenant' in page ? `/${doc.slug}` : `/posts/${doc.slug}`
    return getAbsoluteURL(pathname, baseURL)
  }

  return getServerSideURL()
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
  // Hide Better Auth collections (accounts, sessions, verifications) from tenant-admins; only full admins see them
  hideBetterAuthCollectionsFromTenantAdmins(),
  // Hide platform website management collections from tenant-admins.
  hideWebsiteCollectionsFromTenantAdmins(),
  bookingsPlugin({
    enabled: true,
    lessonOverrides: {
      access: ({ defaultAccess }) => ({
        ...defaultAccess,
        read: lessonsRead, // Preserve tenant scoping while hiding past/inactive lessons from public schedule
        create: tenantScopedCreate,
        update: tenantScopedUpdate,
        delete: tenantScopedDelete,
      }),
    },
    classOptionsOverrides: {
      access: ({ defaultAccess }) => ({
        ...defaultAccess,
        read: tenantScopedPublicReadStrict,
        create: tenantScopedCreate,
        update: tenantScopedUpdate,
        delete: tenantScopedDelete,
      }),
      fields: ({ defaultFields }) => [
        ...defaultFields.map((f) =>
          'name' in f && f.name === 'name' ? { ...f, unique: false } : f,
        ),
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
          beforeValidate: [
            validateClassOptionNameUniqueWithinTenant,
            ...(Array.isArray(d?.beforeValidate) ? d.beforeValidate : []),
          ],
          beforeChange: [...(Array.isArray(d?.beforeChange) ? d.beforeChange : []), requireStripeConnectForPayments],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- plugin HooksConfig omits beforeChange
        } as any
      },
    },
    instructorOverrides: {
      access: ({ defaultAccess }) => ({
        ...defaultAccess,
        read: tenantScopedPublicReadStrict,
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
      // Ensure admin product pickers (Stripe product dropdown) are tenant-scoped (no platform fallback)
      productsProxyScope: 'connect',
      bookingTransactionsOverrides: {
        access: {
          admin: productsRequireStripeConnectAdmin,
          read: productsRequireStripeConnectRead,
          create: productsRequireStripeConnectCreate,
          update: productsRequireStripeConnectUpdate,
          delete: productsRequireStripeConnectDelete,
        },
      },
      classPassesOverrides: {
        access: {
          admin: productsRequireStripeConnectAdmin,
          read: productsRequireStripeConnectRead,
          create: productsRequireStripeConnectCreate,
          update: productsRequireStripeConnectUpdate,
          delete: productsRequireStripeConnectDelete,
        },
      },
      classPassTypesOverrides: {
        access: {
          admin: productsRequireStripeConnectAdmin,
          read: classPassTypesReadWithSoftDelete,
          create: productsRequireStripeConnectCreate,
          update: productsRequireStripeConnectUpdate,
          delete: productsRequireStripeConnectDelete,
        },
        fields: ({ defaultFields }) =>
          [
            ...defaultFields.map((field) => {
              const name = 'name' in field ? field.name : undefined
              if (name === 'skipSync' || name === 'stripeProductId' || name === 'priceJSON' || name === 'priceInformation') {
                return { ...field, access: adminOnlyFieldAccess }
              }
              return field
            }),
            { name: 'deletedAt', type: 'date', admin: { hidden: true }, label: 'Deleted At' },
          ] as Field[],
        hooks: ({ defaultHooks }) => ({
          ...defaultHooks,
          afterChange: [classPassTypeAfterChangeSyncToStripe],
          beforeDelete: [classPassTypeBeforeDeleteArchive],
        }),
      },
      getStripeAccountIdForRequest,
    },
    // Drop-ins: single-use payment options per class option
    dropIns: {
      enabled: true,
      paymentMethodSlugs: ['class-options'],
      dropInsOverrides: {
        access: {
          admin: productsRequireStripeConnectAdmin,
          read: productsRequireStripeConnectRead,
          create: productsRequireStripeConnectCreate,
          update: productsRequireStripeConnectUpdate,
          delete: productsRequireStripeConnectDelete,
        },
      },
    },
    // Membership (subscriptions): recurring plans that grant access; sync job disabled (subscription lifecycle via Connect webhook)
    membership: {
      enabled: true,
      paymentMethodSlugs: ['class-options'],
      getStripeAccountIdForRequest,
      // Ensure the tenant's connected account is the merchant of record (no platform fallback)
      scope: 'connect',
      // Ensure the admin Stripe subscription picker lists from the tenant's connected account
      subscriptionsProxyScope: 'connect',
      syncStripeSubscriptions: false,
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
      plansOverrides: {
        access: {
          admin: productsRequireStripeConnectAdmin,
          read: plansReadWithSoftDelete,
          create: productsRequireStripeConnectCreate,
          update: productsRequireStripeConnectUpdate,
          delete: productsRequireStripeConnectDelete,
        },
        fields: ({ defaultFields }) =>
          [
            ...defaultFields.map((field) => {
              const name = 'name' in field ? field.name : undefined
              if (name === 'skipSync' || name === 'stripeProductId' || name === 'priceJSON' || name === 'priceInformation') {
                return { ...field, access: adminOnlyFieldAccess }
              }
              return field
            }),
            { name: 'deletedAt', type: 'date', admin: { hidden: true }, label: 'Deleted At' },
          ] as Field[],
        hooks: ({ defaultHooks }) => ({
          ...defaultHooks,
          afterChange: [planAfterChangeSyncToStripe],
          beforeDelete: [planBeforeDeleteArchive],
        }),
      },
      subscriptionOverrides: {
        access: {
          admin: productsRequireStripeConnectAdmin,
          read: productsRequireStripeConnectRead,
          create: productsRequireStripeConnectCreate,
          update: productsRequireStripeConnectUpdate,
          delete: productsRequireStripeConnectDelete,
        },
      },
    },
  }),
  // Must run after formBuilderPlugin to add tenant scoping hook to form-submissions
  tenantScopeFormSubmissions(),
  // Multi-tenant plugin must come AFTER bookingsPlugin so it can see the collections it creates
  multiTenantPlugin({
    tenantsSlug: 'tenants',
    cleanupAfterTenantDelete: false,
    // Opt out of baseListFilter on users so tenant selector doesn't filter the list.
    useUsersTenantFilter: false,
    // Bypass the plugin's default users constraint (tenants.tenant in [...]) so tenant-admins
    // can see users who registered at their domain or have a booking there, not only themselves.
    usersAccessResultOverride: async ({ accessKey, accessResult, ...args }) => {
      if (accessKey === 'read') return await userTenantRead(args)
      if (accessKey === 'update') return await userTenantUpdate(args)
      return accessResult
    },
    // Configure admin users to have access to all tenants
    userHasAccessToAllTenants: (user) => {
      if (!user) return false
      return checkRole(['admin'], user as unknown as SharedUser)
    },
    // Type assertion: multi-tenant plugin's types omit collections from @repo/bookings-payments
    collections: {
      // Standard collections
      pages: {
        // Plugin's built-in tenant field is always required (it uses validate() to enforce it).
        // We want "global" pages (no tenant) for the root domain landing page, so we provide
        // our own optional `tenant` field in the Pages collection instead.
        customTenantField: true,
      },
      lessons: {
        tenantFieldOverrides: { admin: { disableBulkEdit: true } },
      },
      instructors: {},
      'class-options': {},
      bookings: {}, // Tenant-scoped for tracking which tenant bookings belong to
      // From @repo/bookings-payments
      'class-pass-types': {}, // Pass types (e.g. Fitness Only, Sauna Only); tenant-scoped
      'class-passes': {}, // Class passes; tenant-scoped
      'transactions': {}, // Payment records per booking (Stripe, class pass, subscription); tenant-scoped via plugin overrides
      'drop-ins': {}, // Drop-in payment options; tenant-scoped
      plans: {}, // Membership plans (collection slug: plans); tenant-scoped
      'discount-codes': {}, // Phase 4.5: Stripe coupons + promotion codes; tenant-scoped
      subscriptions: {}, // User subscriptions; tenant-scoped
      media: {}, // Tenant-scoped media uploads
      forms: {}, // Tenant-scoped for forms
      'form-submissions': {}, // Tenant-scoped for form submissions
      // Globals converted to collections (one per tenant). customTenantField so we can allow
      // optional tenant (null = root site navbar/footer) and clear it in the admin form.
      navbar: { isGlobal: true, customTenantField: true },
      footer: { isGlobal: true, customTenantField: true },
      scheduler: { isGlobal: true },
      // NOTE: users collection is NOT included here to avoid automatic tenant scoping
      // The plugin will still add a 'tenants' field (array) to users automatically
      // We use:
      // - registrationTenant (custom, singular): where user originally registered
      // - tenants (plugin-managed, plural): tenants user has access to
    } as Parameters<typeof multiTenantPlugin>[0]['collections'],
  }),
  // Clearable tenant selector: clear on dashboard/navbar/footer, modal when tenant required on create
  clearableTenantPlugin({
    rootDocCollections: ['navbar', 'footer'],
    collectionsRequireTenantOnCreate: [
      'lessons',
      'instructors',
      'class-options',
      'bookings',
      'class-pass-types',
      'class-passes',
      'transactions',
      'drop-ins',
      'plans',
      'discount-codes',
      'subscriptions',
      'media',
      'forms',
      'form-submissions',
      'scheduler',
    ],
    collectionsCreateRequireTenantForTenantAdmin: ['pages', 'navbar', 'footer'],
    collectionsWithTenantField: ['pages', 'navbar', 'footer'],
    documentTenantFieldName: 'tenant',
    // Used by the selector→document sync hook. We want tenant-admin autosave drafts
    // (Pages create flow) to pick up the selected tenant automatically, while still
    // keeping "no tenant" (base pages) effectively admin-only via the UI.
    userHasAccessToAllTenants: (user) => checkRole(['admin', 'tenant-admin'], user as SharedUser),
  }),
  // Filter out the scheduler global that bookingsPlugin adds (we use a collection instead)
  filterSchedulerGlobal,
  // Phase 5.5: R2 storage for Media — via Worker (R2_WORKER_*) or direct S3 API when env is set
  ...((): Plugin[] => {
    const r2 = getActiveR2Config()
    if (!r2) return []
    return [
      s3Storage({
        bucket: r2.bucket,
        config: r2.config,
        collections: r2.collections,
      }),
    ]
  })(),
]
