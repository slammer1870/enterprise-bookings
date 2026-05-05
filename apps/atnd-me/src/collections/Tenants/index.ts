import type { CollectionConfig } from 'payload'
import { checkRole } from '@repo/shared-utils'
import type { User as SharedUser } from '@repo/shared-types'
import { getUserTenantIds } from '@/access/tenant-scoped'
import { tenantOrgPayloadAdminAccess } from '@/access/userTenantAccess'
import { isValidTimeZone } from '@repo/shared-utils'
import { extraBlockSlugs } from '../../blocks/registry'
import {
  isCustomDomainDnsValidationEnabled,
  normalizeCustomDomain,
  validateCustomDomainDns,
  validateCustomDomainFormat,
  validateCustomDomainNotPlatform,
} from '@/utilities/validateCustomDomain'

const EXTRA_BLOCK_LABELS: Record<string, string> = {
  location: 'Location',
  faqs: 'FAQs',
  tenantScopedSchedule: 'Schedule by Tenant',
  heroScheduleSanctuary: 'Hero & Schedule (Sanctuary)',
  heroWithLocation: 'Hero with Location',
  healthBenefits: 'Health Benefits',
  sectionTagline: 'Section Tagline',
  missionElements: 'Mission Elements',
  mediaBlock: 'Media Block',
  archive: 'Archive',
  formBlock: 'Form Block',
  threeColumnLayout: 'Three Column Layout',
  twoColumnLayout: 'Two Column Layout',
  bruHero: 'Hero (Brú)',
  bruAbout: 'About (Brú)',
  bruSchedule: 'Schedule (Brú)',
  bruLearning: 'Learning (Brú)',
  bruMeetTheTeam: 'Meet The Team (Brú)',
  bruTestimonials: 'Testimonials (Brú)',
  bruContact: 'Contact (Brú)',
  bruHeroWaitlist: 'Hero Waitlist (Brú)',
  dhHero: 'Hero (Dark Horse)',
  dhTeam: 'Team (Dark Horse)',
  dhTimetable: 'Timetable (Dark Horse)',
  dhTestimonials: 'Testimonials (Dark Horse)',
  dhPricing: 'Pricing (Dark Horse)',
  dhContact: 'Contact (Dark Horse)',
  dhGroups: 'Groups (Dark Horse)',
  dhLiveSchedule: 'Live class schedule (Dark Horse)',
  dhLiveMembership: 'Membership — subscribe / manage (tenant)',
  clHeroLoc: 'Croí Lán – Hero with Location',
  clFindSanctuary: 'Croí Lán – Find Your Sanctuary',
  clMission: 'Croí Lán – Mission / Story',
  clPillars: 'Croí Lán – Pillars (Release / Relax / Recover)',
  clSaunaBenefits: 'Croí Lán – Sauna health benefits',
}

/** Stripe Connect onboarding status (step 2.1). */
const STRIPE_CONNECT_STATUS_OPTIONS = [
  'not_connected',
  'pending',
  'active',
  'restricted',
  'deauthorized',
] as const

/** Super-admin or tenant org admin can read Stripe Connect fields; staff cannot. */
function canReadStripeFields(user: unknown): boolean {
  if (!user) return false
  return checkRole(['super-admin', 'admin'], user as SharedUser)
}

/** Only platform super-admin can update restricted tenant fields. */
const adminOnlyUpdate = ({ req }: { req: { user?: unknown } }) =>
  Boolean(req?.user && checkRole(['super-admin'], req.user as SharedUser))

export const Tenants: CollectionConfig = {
  slug: 'tenants',
  admin: {
    useAsTitle: 'name',
    group: 'Configuration',
    defaultColumns: ['name', 'slug', 'createdAt'],
  },
  access: {
    admin: tenantOrgPayloadAdminAccess,
    read: (args) => {
      const { req: { user } } = args
      if (user && checkRole(['super-admin'], user as unknown as SharedUser)) {
        return true
      }
      if (user && checkRole(['admin'], user as unknown as SharedUser)) {
        const tenantIds = getUserTenantIds(user as unknown as SharedUser)
        if (tenantIds === null || tenantIds.length === 0) return false
        return { id: { in: tenantIds } }
      }
      return true
    },
    create: (args) => {
      const { req: { user } } = args
      if (!user) return false
      return checkRole(['super-admin'], user as unknown as SharedUser)
    },
    update: (args) => {
      const { req: { user } } = args
      if (!user) return false
      if (checkRole(['super-admin'], user as unknown as SharedUser)) return true
      if (checkRole(['admin'], user as unknown as SharedUser)) {
        const tenantIds = getUserTenantIds(user as unknown as SharedUser)
        if (tenantIds === null || tenantIds.length === 0) return false
        return { id: { in: tenantIds } }
      }
      return false
    },
    delete: (args) => {
      const { req: { user } } = args
      if (!user) return false
      return checkRole(['super-admin'], user as unknown as SharedUser)
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
      name: 'timeZone',
      type: 'text',
      required: false,
      admin: {
        description:
          'IANA timezone for this tenant, for example Europe/Dublin or America/New_York. If empty, the app default timezone is used.',
      },
      validate: (value: unknown) => {
        const timeZone = typeof value === 'string' ? value.trim() : ''
        if (!timeZone) return true
        return isValidTimeZone(timeZone) || 'Enter a valid IANA timezone'
      },
    },
    {
      name: 'domain',
      type: 'text',
      required: false,
      index: true,
      admin: {
        description:
          'Custom domain for this tenant (e.g. studio.example.com). Enter only the hostname—no protocol or path. Must be unique; cannot be the platform domain or localhost. When VALIDATE_TENANT_CUSTOM_DOMAIN_DNS=true, the domain must have DNS records (A, AAAA, or CNAME) before saving.',
      },
      validate: (value: unknown) => {
        const str = value == null ? '' : String(value).trim()
        const formatResult = validateCustomDomainFormat(str || null)
        if (formatResult !== true) return formatResult
        if (str === '') return true
        const normalized = normalizeCustomDomain(str)
        const notPlatformResult = validateCustomDomainNotPlatform(normalized)
        return notPlatformResult
      },
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
      name: 'stripeConnectStatus',
      type: 'ui',
      admin: {
        position: 'sidebar',
        components: {
          Field: '@/components/admin/StripeConnectStatus',
        },
      },
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
      name: 'stripeConnectDashboardLink',
      type: 'ui',
      admin: {
        position: 'sidebar',
        components: {
          Field: {
            path: '@/components/admin/StripeDashboardLinkField#StripeDashboardLinkField',
            clientProps: {
              target: 'account',
              label: 'View account in Stripe',
            },
          },
        },
      },
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
        read: ({ req }) => Boolean(req?.user && checkRole(['super-admin'], req.user as SharedUser)),
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
  hooks: {
    beforeValidate: [
      async ({ data, operation, req, originalDoc }) => {
        if (!data) return data

        // Normalize "removed custom domain" to `null` so Payload actually persists
        // the cleared value. (Using `undefined` typically means "don't update this field".)
        if (data?.domain == null) {
          data.domain = null
          return data
        }

        if (typeof data.domain !== 'string') return data

        const normalized = normalizeCustomDomain(data.domain)
        data.domain = normalized === '' ? null : normalized
        if (!data.domain) return data

        const currentId = operation === 'update' && originalDoc?.id ? originalDoc.id : null
        const existing = await req.payload.find({
          collection: 'tenants',
          where: {
            domain: { equals: data.domain },
            ...(currentId != null ? { id: { not_equals: currentId } } : {}),
          },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })

        if (existing.docs.length > 0) {
          throw new Error(
            `Another tenant already uses the custom domain "${data.domain}". Custom domains must be unique.`
          )
        }

        if (isCustomDomainDnsValidationEnabled()) {
          const dnsResult = await validateCustomDomainDns(data.domain)
          if (dnsResult !== true) {
            throw new Error(dnsResult)
          }
        }

        return data
      },
    ],
  },
}

