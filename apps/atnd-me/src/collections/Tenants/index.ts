import type { CollectionConfig } from 'payload'
import { checkRole } from '@repo/shared-utils'
import type { User as SharedUser } from '@repo/shared-types'
import { extraBlockSlugs } from '../../blocks/registry'

const EXTRA_BLOCK_LABELS: Record<string, string> = {
  location: 'Location',
  faqs: 'FAQs',
  mediaBlock: 'Media Block',
  archive: 'Archive',
  formBlock: 'Form Block',
  threeColumnLayout: 'Three Column Layout',
}

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
      name: 'allowedBlocks',
      type: 'select',
      hasMany: true,
      options: extraBlockSlugs.map((slug) => ({
        label: EXTRA_BLOCK_LABELS[slug] ?? slug,
        value: slug,
      })),
      admin: {
        description: 'Extra blocks this tenant can use on pages. Default blocks (Hero, Hero Schedule, About, Schedule, Content, CTA) are always available.',
      },
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
  ],
}

