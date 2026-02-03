import type { CollectionConfig } from 'payload'
import { checkRole } from '@repo/shared-utils'
import type { User as SharedUser } from '@repo/shared-types'
import { createDefaultTenantData } from './hooks/createDefaultData'

/** Stripe Connect onboarding status (step 2.1). */
const STRIPE_CONNECT_STATUS_OPTIONS = [
  'not_connected',
  'pending',
  'active',
  'restricted',
  'deauthorized',
] as const

/** True if req.user is admin or tenant-admin (for Stripe field visibility). */
function canReadStripeFields(user: unknown): boolean {
  if (!user) return false
  return checkRole(['admin', 'tenant-admin'], user as SharedUser)
}

export const Tenants: CollectionConfig = {
  slug: 'tenants',
  admin: {
    useAsTitle: 'name',
    group: 'Configuration',
    defaultColumns: ['name', 'slug', 'createdAt'],
  },
  access: {
    admin: ({ req: { user } }) => {
      if (!user) return false
      return checkRole(['admin'], user as unknown as SharedUser)
    },
    read: (args) => {
      const { req: { user } } = args
      if (user && checkRole(['admin'], user as unknown as SharedUser)) {
        return true
      }
      // Tenant-admins can read only their assigned tenant(s) (e.g. for Stripe Connect status)
      if (user && checkRole(['tenant-admin'], user as unknown as SharedUser)) {
        const u = user as { tenants?: { tenant: number | { id: number } }[] | null }
        const tenantIds = (u.tenants ?? [])
          .map((t) => (typeof t.tenant === 'object' && t.tenant != null && 'id' in t.tenant ? (t.tenant as { id: number }).id : t.tenant))
          .filter((id): id is number => typeof id === 'number')
        if (tenantIds.length === 0) return false
        return { id: { in: tenantIds } }
      }
      return true
    },
    create: (args) => {
      const { req: { user } } = args
      if (!user) return false
      return checkRole(['admin'], user as unknown as SharedUser)
    },
    update: (args) => {
      const { req: { user } } = args
      if (!user) return false
      return checkRole(['admin'], user as unknown as SharedUser)
    },
    delete: (args) => {
      const { req: { user } } = args
      if (!user) return false
      return checkRole(['admin'], user as unknown as SharedUser)
    },
  },
  hooks: {
    afterChange: [
      async ({ doc, operation, req }) => {
        // Create default data when tenant is created. Run in the same request so we
        // share the same transaction/connection and tenant_id is visible for FK (avoids
        // races with parallel tests where deferred callbacks run after test rollback).
        if (operation === 'create') {
          // Optional: allow skipping expensive default-data creation for specific runs.
          if (process.env.PW_E2E_SKIP_DEFAULT_TENANT_DATA === 'true') return

          const tenant = doc
          const payload = req.payload
          try {
            await createDefaultTenantData({ tenant, payload, req })
          } catch (e) {
            payload.logger.error(
              `Error in createDefaultTenantData for tenant ${tenant.name}: ${e instanceof Error ? e.message : String(e)}`
            )
            // Don't throw - allow tenant creation to succeed; admin can create data manually
          }
        }
      },
    ],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'domain',
      type: 'text',
      required: false,
    },
    {
      name: 'description',
      type: 'textarea',
      required: false,
    },
    {
      name: 'logo',
      type: 'upload',
      relationTo: 'media',
      required: false,
    },
    // Stripe Connect (step 2.1) – admin and tenant-admin only
    {
      name: 'stripeConnectAccountId',
      type: 'text',
      required: false,
      unique: true,
      admin: { description: 'Stripe Connect account ID (set by OAuth callback).' },
      access: { read: ({ req }) => canReadStripeFields(req.user) },
    },
    {
      name: 'stripeConnectOnboardingStatus',
      type: 'select',
      required: false,
      options: [...STRIPE_CONNECT_STATUS_OPTIONS],
      defaultValue: 'not_connected',
      admin: { description: 'Connect onboarding status (updated via webhooks).' },
      access: { read: ({ req }) => canReadStripeFields(req.user) },
    },
    {
      name: 'stripeConnectLastError',
      type: 'textarea',
      required: false,
      admin: { description: 'Last OAuth or webhook error (admin-only).' },
      access: { read: ({ req }) => Boolean(req?.user && checkRole(['admin'], req.user as SharedUser)) },
    },
    {
      name: 'stripeConnectConnectedAt',
      type: 'date',
      required: false,
      admin: { description: 'When Connect was linked.' },
      access: { read: ({ req }) => canReadStripeFields(req.user) },
    },
    // Step 9 – Class pass configuration (used by purchase flow)
    {
      name: 'classPassSettings',
      type: 'group',
      label: 'Class pass settings',
      admin: { description: 'Configure class pass packages and defaults for this tenant.' },
      fields: [
        {
          name: 'enabled',
          type: 'checkbox',
          label: 'Enable class passes',
          defaultValue: false,
        },
        {
          name: 'defaultExpirationDays',
          type: 'number',
          label: 'Default expiration (days)',
          defaultValue: 365,
          admin: { description: 'Default validity when no package specifies it.' },
        },
        {
          name: 'pricing',
          type: 'array',
          label: 'Pass packages',
          fields: [
            { name: 'quantity', type: 'number', label: 'Quantity', required: true, min: 1 },
            { name: 'price', type: 'number', label: 'Price (cents)', required: true, min: 0 },
            { name: 'name', type: 'text', label: 'Name', required: true, admin: { description: 'e.g. "5-Pack", "10-Pack"' } },
          ],
        },
      ],
    },
  ],
}

