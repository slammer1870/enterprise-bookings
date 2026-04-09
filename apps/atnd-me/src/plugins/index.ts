import { formBuilderPlugin } from '@payloadcms/plugin-form-builder'
import { nestedDocsPlugin } from '@payloadcms/plugin-nested-docs'
import { redirectsPlugin } from '@payloadcms/plugin-redirects'
import { seoPlugin } from '@payloadcms/plugin-seo'
import { searchPlugin } from '@payloadcms/plugin-search'
import { multiTenantPlugin } from '@payloadcms/plugin-multi-tenant'
import { sentryPlugin } from '@payloadcms/plugin-sentry'
import type { Field, Payload } from 'payload'
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
import { validateEventTypeNameUniqueWithinTenant } from '@/hooks/validateEventTypeNameUniqueWithinTenant'
import { getTenantIdForCreateRequest } from '@/utilities/getTenantContext'
import { bookingsPlugin } from '@repo/bookings-plugin'
import { timeslotsRead } from '@/access/timeslotsRead'
import {
  tenantScopedCreate,
  tenantScopedUpdate,
  tenantScopedDelete,
  tenantScopedReadFiltered,
  tenantScopedPublicReadStrict,
  getUserTenantIds,
} from '../access/tenant-scoped'
import {
  productsRequireStripeConnectRead,
  productsRequireStripeConnectCreate,
  productsRequireStripeConnectUpdate,
  productsRequireStripeConnectDelete,
  productsRequireStripeConnectAdmin,
  adminOnlyFieldAccess,
  adminOrTenantAdminFieldAccess,
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
import { isStaff, userTenantRead, userTenantUpdate, isTenantAdmin } from '../access/userTenantAccess'
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
import { ATND_ME_BOOKINGS_COLLECTION_SLUGS } from '@/constants/bookings-collection-slugs'

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

async function assignTenantOnCreateFromRequest({
  data,
  operation,
  req,
}: {
  data: Record<string, unknown> | undefined
  operation: 'create' | 'update'
  req: {
    context?: Record<string, unknown>
    cookies?: { get: (name: string) => { value?: string } | undefined }
    headers?: Headers
    payload: Payload
  }
}) {
  if (operation !== 'create' || !data || data.tenant) return data

  const tenantId = await getTenantIdForCreateRequest(req.payload, {
    context: req.context,
    cookies: req.cookies,
    headers: req.headers,
  })

  if (tenantId != null && tenantId !== '') {
    data.tenant = tenantId
  }

  return data
}

function createTenantSelectorSyncField(): Field {
  return {
    name: '_tenantSelectorSync',
    type: 'ui',
    admin: {
      position: 'sidebar',
      components: {
        Field: '@repo/plugin-clearable-tenant/client#SyncTenantSelectorToFormField',
      },
    },
  }
}

function createTenantRelationshipField(): Field {
  return {
    name: 'tenant',
    type: 'relationship',
    relationTo: 'tenants',
    required: true,
    label: 'Tenant',
    index: true,
    admin: {
      position: 'sidebar',
      hidden: true,
      description: 'Controlled by the tenant selector when creating tenant-scoped documents.',
    },
    filterOptions: ({ req }) => {
      const tenantIds = getUserTenantIds((req.user ?? null) as SharedUser | null)
      if (tenantIds === null) return true
      if (Array.isArray(tenantIds) && tenantIds.length > 0) {
        return { id: { in: tenantIds } }
      }
      return true
    },
  }
}

function withExplicitTenantSyncFields(defaultFields: Field[]): Field[] {
  const fields = [...defaultFields]

  if (!fields.some((field) => 'name' in field && field.name === 'tenant')) {
    fields.unshift(createTenantRelationshipField())
  }

  if (!fields.some((field) => 'name' in field && field.name === '_tenantSelectorSync')) {
    fields.push(createTenantSelectorSyncField())
  }

  return fields
}

type NestedFieldAccess = typeof adminOnlyFieldAccess

const stripeManagedSubscriptionFieldAccess = {
  update: ({ doc }: { doc?: Record<string, unknown> | null }) => !doc?.stripeSubscriptionId,
}

function withNestedFieldAccess(field: Field, access: NestedFieldAccess): Field {
  const next = { ...field, access } as Field

  if ('fields' in next && Array.isArray(next.fields)) {
    return {
      ...next,
      fields: next.fields.map((child) => withNestedFieldAccess(child, access)),
    } as Field
  }

  return next
}

function lockStripeManagedSubscriptionFields(field: Field): Field {
  const name = 'name' in field ? field.name : undefined
  const next = { ...field } as Field

  if (name === 'status' || name === 'cancelAt' || name === 'startDate' || name === 'endDate') {
    return {
      ...next,
      access: {
        ...(('access' in next && typeof next.access === 'object' && next.access) ? next.access : {}),
        ...stripeManagedSubscriptionFieldAccess,
      },
    } as Field
  }

  if ('fields' in next && Array.isArray(next.fields)) {
    return {
      ...next,
      fields: next.fields.map((child) => lockStripeManagedSubscriptionFields(child)),
    } as Field
  }

  return next
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
    roles: ['user', 'staff', 'admin', 'super-admin'],
    defaultRole: 'user',
    firstUserRole: 'super-admin',
  }),
  // Must run after both payloadAuth() and rolesPlugin() to sync role/roles fields
  fixBetterAuthRoleField(),
  // Hide Better Auth collections (accounts, sessions, verifications) from tenant-admins; only full admins see them
  hideBetterAuthCollectionsFromTenantAdmins(),
  // Hide platform website management collections from tenant-admins.
  hideWebsiteCollectionsFromTenantAdmins(),
  bookingsPlugin({
    enabled: true,
    slugs: ATND_ME_BOOKINGS_COLLECTION_SLUGS,
    timeslotOverrides: {
      versions: false,
      fields: ({ defaultFields }) => withExplicitTenantSyncFields(defaultFields),
      hooks: ({ defaultHooks }) => {
        const d = defaultHooks as Record<string, unknown>
        return {
          ...defaultHooks,
          beforeValidate: [
            async ({ data, operation, req }: { data?: Record<string, unknown>; operation: 'create' | 'update'; req: { context?: Record<string, unknown>; cookies?: { get: (name: string) => { value?: string } | undefined }; headers?: Headers; payload: Payload } }) =>
              await assignTenantOnCreateFromRequest({
                data: data as Record<string, unknown> | undefined,
                operation,
                req,
              }),
            ...(Array.isArray(d?.beforeValidate) ? d.beforeValidate : []),
          ],
        }
      },
      access: ({ defaultAccess }) => ({
        ...defaultAccess,
        read: timeslotsRead, // Preserve tenant scoping while hiding past/inactive timeslots from public schedule
        create: tenantScopedCreate,
        update: tenantScopedUpdate,
        delete: tenantScopedDelete,
      }),
    },
    eventTypesOverrides: {
      access: ({ defaultAccess }) => ({
        ...defaultAccess,
        read: tenantScopedPublicReadStrict,
        create: async (args) => {
          if (args.req.user && isStaff(args.req.user) && !isTenantAdmin(args.req.user)) return false
          return tenantScopedCreate(args)
        },
        update: async (args) => {
          if (args.req.user && isStaff(args.req.user) && !isTenantAdmin(args.req.user)) return false
          return tenantScopedUpdate(args)
        },
        delete: async (args) => {
          if (args.req.user && isStaff(args.req.user) && !isTenantAdmin(args.req.user)) return false
          return tenantScopedDelete(args)
        },
      }),
      fields: ({ defaultFields }) => [
        ...withExplicitTenantSyncFields(defaultFields).map((f) =>
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
            async ({ data, operation, req }: { data?: Record<string, unknown>; operation: 'create' | 'update'; req: { context?: Record<string, unknown>; cookies?: { get: (name: string) => { value?: string } | undefined }; headers?: Headers; payload: Payload } }) =>
              await assignTenantOnCreateFromRequest({
                data: data as Record<string, unknown> | undefined,
                operation,
                req,
              }),
            validateEventTypeNameUniqueWithinTenant,
            ...(Array.isArray(d?.beforeValidate) ? d.beforeValidate : []),
          ],
          beforeChange: [...(Array.isArray(d?.beforeChange) ? d.beforeChange : []), requireStripeConnectForPayments],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- plugin HooksConfig omits beforeChange
        } as any
      },
    },
    staffMembersOverrides: {
      access: ({ defaultAccess }) => ({
        ...defaultAccess,
        read: tenantScopedPublicReadStrict,
        create: async (args) => {
          if (args.req.user && isStaff(args.req.user) && !isTenantAdmin(args.req.user)) return false
          return tenantScopedCreate(args)
        },
        update: async (args) => {
          if (args.req.user && isStaff(args.req.user) && !isTenantAdmin(args.req.user)) return false
          return tenantScopedUpdate(args)
        },
        delete: async (args) => {
          if (args.req.user && isStaff(args.req.user) && !isTenantAdmin(args.req.user)) return false
          return tenantScopedDelete(args)
        },
      }),
      fields: ({ defaultFields }) => withExplicitTenantSyncFields(defaultFields),
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
          // Auto-set tenant from timeslot for multi-tenant support
          async ({ req, data, operation }) => {
            if (operation === 'create' && data?.timeslot && !data?.tenant) {
              const timeslotId = typeof data.timeslot === 'object' ? data.timeslot.id : data.timeslot
              const timeslot = await req.payload.findByID({
                collection: ATND_ME_BOOKINGS_COLLECTION_SLUGS.timeslots,
                id: timeslotId,
                depth: 0,
              })
              if (timeslot?.tenant) {
                const tenantId = typeof timeslot.tenant === 'object' && timeslot.tenant !== null
                  ? timeslot.tenant.id
                  : timeslot.tenant
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
      eventTypesSlug: 'event-types',
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
              if (name === 'priceInformation') {
                return withNestedFieldAccess(field, adminOrTenantAdminFieldAccess)
              }
              if (name === 'skipSync' || name === 'stripeProductId' || name === 'priceJSON') {
                return { ...field, access: adminOnlyFieldAccess }
              }
              return field
            }),
            {
              name: 'stripeProductDashboardLink',
              type: 'ui',
              admin: {
                position: 'sidebar',
                components: {
                  Field: {
                    path: '@/components/admin/StripeDashboardLinkField#StripeDashboardLinkField',
                    clientProps: {
                      target: 'product',
                      label: 'View product in Stripe',
                    },
                  },
                },
              },
            },
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
      paymentMethodSlugs: ['event-types'],
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
      paymentMethodSlugs: ['event-types'],
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
              if (name === 'priceInformation') {
                return withNestedFieldAccess(field, adminOrTenantAdminFieldAccess)
              }
              if (name === 'skipSync' || name === 'stripeProductId' || name === 'priceJSON') {
                return { ...field, access: adminOnlyFieldAccess }
              }
              return field
            }),
            {
              name: 'stripeProductDashboardLink',
              type: 'ui',
              admin: {
                position: 'sidebar',
                components: {
                  Field: {
                    path: '@/components/admin/StripeDashboardLinkField#StripeDashboardLinkField',
                    clientProps: {
                      target: 'product',
                      label: 'View product in Stripe',
                    },
                  },
                },
              },
            },
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
        fields: ({ defaultFields }) =>
          [
            ...defaultFields.map((field) => lockStripeManagedSubscriptionFields(field)),
            {
              name: 'createStripeSubscriptionAction',
              type: 'ui',
              admin: {
                position: 'sidebar',
                components: {
                  Field: '@/components/admin/CreateStripeSubscriptionButton#CreateStripeSubscriptionButton',
                },
              },
            },
            {
              name: 'stripeSubscriptionDashboardLink',
              type: 'ui',
              admin: {
                position: 'sidebar',
                components: {
                  Field: {
                    path: '@/components/admin/StripeDashboardLinkField#StripeDashboardLinkField',
                    clientProps: {
                      target: 'subscription',
                      label: 'View subscription in Stripe',
                    },
                  },
                },
              },
            },
            {
              name: 'stripeCustomerDashboardLink',
              type: 'ui',
              admin: {
                position: 'sidebar',
                components: {
                  Field: {
                    path: '@/components/admin/StripeDashboardLinkField#StripeDashboardLinkField',
                    clientProps: {
                      target: 'customer',
                      label: 'View customer in Stripe',
                    },
                  },
                },
              },
            },
          ] as Field[],
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
      return checkRole(['super-admin'], user as unknown as SharedUser)
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
      timeslots: {
        customTenantField: true,
        tenantFieldOverrides: { admin: { disableBulkEdit: true } },
        // Disable the plugin's withTenantAccess wrapper for timeslots (timeslots).
        // Our custom `timeslotsRead` access function already handles all tenant scoping
        // (super-admin, tenant portal users with DB fallback, public/regular users via request context).
        // The plugin's wrapper causes a bug for authenticated better-auth users: their session
        // object has collection='users' but no `tenants` array (not saved to JWT), so
        // withTenantAccess generates { tenant: { in: [] } } which matches no documents.
        useTenantAccess: false,
      },
      'staff-members': { customTenantField: true },
      'event-types': { customTenantField: true },
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
      'timeslots',
      'staff-members',
      'event-types',
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
    collectionsWithTenantField: [
      'pages',
      'navbar',
      'footer',
      'timeslots',
      'staff-members',
      'event-types',
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
    documentTenantFieldName: 'tenant',
    // Used by the selector→document sync hook. We want tenant-admin autosave drafts
    // (Pages create flow) to pick up the selected tenant automatically, while still
    // keeping "no tenant" (base pages) effectively admin-only via the UI.
    userHasAccessToAllTenants: (user) =>
      checkRole(['super-admin', 'admin', 'staff'], user as SharedUser),
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
