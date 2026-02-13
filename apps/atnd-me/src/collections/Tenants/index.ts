import type { CollectionConfig } from 'payload'
import { checkRole } from '@repo/shared-utils'
import type { User as SharedUser } from '@repo/shared-types'
import { getUserTenantIds } from '@/access/tenant-scoped'
import { extraBlockSlugs } from '../../blocks/registry'

const EXTRA_BLOCK_LABELS: Record<string, string> = {
  location: 'Location',
  faqs: 'FAQs',
  tenantScopedSchedule: 'Schedule by Tenant',
  heroScheduleSanctuary: 'Hero & Schedule (Sanctuary)',
  healthBenefits: 'Health Benefits',
  sectionTagline: 'Section Tagline',
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

/** Only full admin can update Stripe Connect fields (set by OAuth/webhooks). */
const adminOnlyUpdate = ({ req }: { req: { user?: unknown } }) =>
  Boolean(req?.user && checkRole(['admin'], req.user as SharedUser))

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
      return checkRole(['admin', 'tenant-admin'], user as unknown as SharedUser)
    },
    read: (args) => {
      const { req: { user } } = args
      if (user && checkRole(['admin'], user as unknown as SharedUser)) {
        return true
      }
      // Tenant-admins can read only their assigned tenant(s) (e.g. for Stripe Connect status, logo)
      if (user && checkRole(['tenant-admin'], user as unknown as SharedUser)) {
        const tenantIds = getUserTenantIds(user as unknown as SharedUser)
        if (tenantIds === null || tenantIds.length === 0) return false
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
      if (checkRole(['admin'], user as unknown as SharedUser)) return true
      // Tenant-admins can update only their assigned tenant(s) (e.g. logo, description)
      if (checkRole(['tenant-admin'], user as unknown as SharedUser)) {
        const tenantIds = getUserTenantIds(user as unknown as SharedUser)
        if (tenantIds === null || tenantIds.length === 0) return false
        return { id: { in: tenantIds } }
      }
      return false
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
      access: {
        update: adminOnlyUpdate, // Only admin can change slug; tenant-admins cannot
      },
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
      access: {
        update: adminOnlyUpdate, // Only admin can change allowed blocks; tenant-admins cannot
      },
    },
    {
      name: 'logo',
      type: 'upload',
      relationTo: 'media',
      required: false,
    },
    // Stripe Connect (step 2.1) – admin and tenant-admin can read; only admin can update (OAuth/webhooks set these)
    {
      name: 'stripeConnectAccountId',
      type: 'text',
      required: false,
      unique: true,
      admin: { description: 'Stripe Connect account ID (set by OAuth callback).' },
      access: { read: ({ req }) => canReadStripeFields(req.user), update: adminOnlyUpdate },
    },
    {
      name: 'stripeConnectOnboardingStatus',
      type: 'select',
      required: false,
      options: [...STRIPE_CONNECT_STATUS_OPTIONS],
      defaultValue: 'not_connected',
      admin: { description: 'Connect onboarding status (updated via webhooks).' },
      access: { read: ({ req }) => canReadStripeFields(req.user), update: adminOnlyUpdate },
    },
    {
      name: 'stripeConnectLastError',
      type: 'textarea',
      required: false,
      admin: { description: 'Last OAuth or webhook error (admin-only).' },
      access: {
        read: ({ req }) => Boolean(req?.user && checkRole(['admin'], req.user as SharedUser)),
        update: adminOnlyUpdate,
      },
    },
    {
      name: 'stripeConnectConnectedAt',
      type: 'date',
      required: false,
      admin: { description: 'When Connect was linked.' },
      access: { read: ({ req }) => canReadStripeFields(req.user), update: adminOnlyUpdate },
    },
  ],
}

