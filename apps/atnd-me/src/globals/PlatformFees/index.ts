/**
 * Step 2.7.1 – Platform fees global: defaults, per-tenant overrides, optional bounds.
 * read/update: admin only.
 */
import type { GlobalConfig } from 'payload'
import { checkRole } from '@repo/shared-utils'
import type { User as SharedUser } from '@repo/shared-types'

export const PlatformFees: GlobalConfig = {
  slug: 'platform-fees',
  label: 'Platform Fees',
  admin: {
    group: 'Configuration',
    description: 'Default booking fee percentages by product type and optional per-tenant overrides.',
  },
  access: {
    read: ({ req }) => Boolean(req?.user && checkRole(['admin'], req.user as SharedUser)),
    update: ({ req }) => Boolean(req?.user && checkRole(['admin'], req.user as SharedUser)),
  },
  fields: [
    {
      name: 'defaults',
      type: 'group',
      label: 'Default percentages',
      required: true,
      fields: [
        {
          name: 'dropInPercent',
          type: 'number',
          label: 'Drop-in (%)',
          required: true,
          defaultValue: 2,
          admin: { description: 'Default fee for drop-in bookings.' },
        },
        {
          name: 'classPassPercent',
          type: 'number',
          label: 'Class pass (%)',
          required: true,
          defaultValue: 3,
          admin: { description: 'Default fee for class pass bookings.' },
        },
        {
          name: 'subscriptionPercent',
          type: 'number',
          label: 'Subscription (%)',
          required: true,
          defaultValue: 4,
          admin: { description: 'Default fee for subscription payments.' },
        },
      ],
    },
    {
      name: 'overrides',
      type: 'array',
      label: 'Per-tenant overrides',
      admin: { description: 'Override fee percent for specific tenants.' },
      fields: [
        {
          name: 'tenant',
          type: 'relationship',
          relationTo: 'tenants',
          required: true,
          label: 'Tenant',
        },
        {
          name: 'dropInPercent',
          type: 'number',
          label: 'Drop-in (%)',
          admin: { description: 'Leave empty to use default.' },
        },
        {
          name: 'classPassPercent',
          type: 'number',
          label: 'Class pass (%)',
          admin: { description: 'Leave empty to use default.' },
        },
        {
          name: 'subscriptionPercent',
          type: 'number',
          label: 'Subscription (%)',
          admin: { description: 'Leave empty to use default.' },
        },
      ],
    },
    {
      name: 'bounds',
      type: 'group',
      label: 'Optional bounds (cents)',
      admin: { description: 'Clamp fee amount to min/max cents; leave empty for no clamp.' },
      fields: [
        {
          name: 'minCents',
          type: 'number',
          label: 'Min cents',
          admin: { description: 'Minimum fee in cents (never applied if it would make fee negative).' },
        },
        {
          name: 'maxCents',
          type: 'number',
          label: 'Max cents',
          admin: { description: 'Maximum fee in cents.' },
        },
      ],
    },
  ],
}
