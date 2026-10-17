import type { CollectionConfig } from 'payload'
import { defaultTimezones } from 'payload/shared'
import { checkRole } from '@repo/shared-utils'
import type { User as SharedUser } from '@repo/shared-types'
import {
  getTenantMembershipIdsFromUserDoc,
  loadUserDocForTenantMembership,
  resolveOrgAdminTenantIds,
} from '@/access/tenant-scoped'
import { tenantOrgPayloadAdminAccess } from '@/access/userTenantAccess'
import { normalizeAndValidateTenantSlugFormat } from '@repo/shared-utils'
import { extraBlockSlugs } from '../../blocks/registry'
import {
  DEFAULT_DIRECTION,
  HOSTNAME_DIRECTIONS,
  normalizeHostnameList,
} from '@/utilities/tenantPublicHostDeclaration'
import {
  validateRawPublicHostInputs,
  validateTenantPublicHostDeclarationOnSave,
} from '@/utilities/validateTenantPublicHostOnSave'
import { applePayDomainsForDeclaration, registerApplePayDomain } from './registerApplePayDomain'
import { customHostnamesToRegister } from './apexDomainHook'
import { createOrGetCustomHostname } from '@/lib/cloudflare/customHostnames'
import { isPlatformEmailApex, resolveEmailSendingDomain } from '@/lib/resend/emailSendingDomain'
import { provisionTenantEmailDomain } from '@/lib/resend/provisionTenantEmailDomain'

const DEFAULT_TENANT_TIME_ZONE = 'Europe/Dublin'

/** Payload's defaults omit Dublin; put it first since it's the app/tenant default. */
const tenantTimeZoneOptions = [
  { label: '(UTC+00:00) Dublin (GMT/IST)', value: DEFAULT_TENANT_TIME_ZONE },
  ...defaultTimezones.filter((tz) => tz.value !== DEFAULT_TENANT_TIME_ZONE),
]

const EMAIL_DOMAIN_STATUS_OPTIONS = [
  'not_configured',
  'not_started',
  'pending',
  'verified',
  'failed',
] as const
const EXTRA_BLOCK_LABELS: Record<string, string> = {
  location: 'Location',
  faqs: 'FAQs',
  tenantScopedSchedule: 'Schedule by Tenant',
  heroScheduleSanctuary: 'Hero & Schedule (Multi Location)',
  heroWithLocation: 'Hero with Location',
  healthBenefits: 'Health Benefits',
  sectionTagline: 'Section Tagline',
  missionElements: 'Mission Elements',
  mediaBlock: 'Media Block',
  archive: 'Archive',
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
  kyuzoHero: 'Hero (Kyuzo)',
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
    read: async (args) => {
      const {
        req: { user, payload, context },
      } = args
      // No anonymous / unauthenticated listing. Public site + middleware resolve tenants
      // via trusted Local API (`overrideAccess: true`), not open REST read.
      // Return an empty constraint (not `false`) so finds resolve to [] instead of Forbidden.
      if (!user) return { id: { in: [] } }

      if (checkRole(['super-admin'], user as unknown as SharedUser)) {
        return true
      }

      // Org admins: only orgs they administer — drives Users membership pickers.
      // Do not gate on global `role` including `admin`: Better Auth / field access may
      // omit derived role while `tenants[n].roles` still includes admin. Membership as
      // user/staff elsewhere must not appear as addable tenants.
      const orgAdminTenantIds = await resolveOrgAdminTenantIds({
        user,
        payload,
        context: context as Record<string, unknown> | undefined,
      })
      if (orgAdminTenantIds.length > 0) {
        return { id: { in: orgAdminTenantIds } }
      }

      // Staff / location-managers / members: only tenants they belong to (or registered with).
      let membershipIds = getTenantMembershipIdsFromUserDoc(user)
      if (membershipIds.length === 0) {
        const idRaw =
          typeof user === 'object' && user !== null && 'id' in user
            ? (user as { id: unknown }).id
            : null
        const userId =
          typeof idRaw === 'number'
            ? idRaw
            : typeof idRaw === 'string'
              ? parseInt(idRaw, 10)
              : NaN
        if (Number.isFinite(userId)) {
          const fullUser = await loadUserDocForTenantMembership(payload, userId)
          membershipIds = fullUser ? getTenantMembershipIdsFromUserDoc(fullUser) : []
        }
      }
      if (membershipIds.length === 0) return { id: { in: [] } }
      return { id: { in: membershipIds } }
    },
    create: (args) => {
      const { req: { user } } = args
      if (!user) return false
      return checkRole(['super-admin'], user as unknown as SharedUser)
    },
    update: async (args) => {
      const {
        req: { user, payload, context },
      } = args
      if (!user) return false
      if (checkRole(['super-admin'], user as unknown as SharedUser)) return true
      // Same as read: prefer org-admin memberships over derived global `admin` role.
      const tenantIds = await resolveOrgAdminTenantIds({
        user,
        payload,
        context: context as Record<string, unknown> | undefined,
      })
      if (tenantIds.length === 0) return false
      return { id: { in: tenantIds } }
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
      admin: {
        description:
          'Subdomain for this tenant (e.g. studio → studio.atnd.me). Lowercase letters, numbers, and hyphens only.',
      },
      validate: (value: unknown) => {
        const result = normalizeAndValidateTenantSlugFormat(value)
        return result.ok || result.error
      },
    },
    {
      name: 'timeZone',
      type: 'select',
      required: false,
      defaultValue: DEFAULT_TENANT_TIME_ZONE,
      options: tenantTimeZoneOptions,
      admin: {
        description:
          'Timezone for schedules and booking times for this tenant. Defaults to Dublin.',
      },
    },
    {
      name: 'hostnames',
      type: 'json',
      label: 'Hostnames',
      required: false,
      admin: {
        description:
          'Comma-separated hostnames. The platform subdomain is assigned from the slug and is not typed here.',
        components: { Field: '@/components/admin/HostnameListField#HostnameListField' },
      },
    },
    {
      name: 'direction',
      type: 'select',
      label: 'Direction',
      defaultValue: DEFAULT_DIRECTION,
      options: [
        { label: 'Allow www and non-www', value: HOSTNAME_DIRECTIONS[0] },
        { label: 'Redirect to www', value: HOSTNAME_DIRECTIONS[1] },
        { label: 'Redirect to non-www', value: HOSTNAME_DIRECTIONS[2] },
      ],
      admin: {
        description:
          'One rule for every www/apex pair in the hostname list. The default is Allow www and non-www.',
        components: { Field: '@/components/admin/DirectionField#DirectionField' },
      },
    },
    {
      name: 'publicHosts',
      type: 'ui',
      label: 'Public hosts',
      admin: {
        components: { Field: '@/components/admin/PublicHostList' },
      },
    },
    {
      name: 'apexDomainVerificationToken',
      type: 'text',
      required: false,
      admin: { hidden: true },
      access: { update: adminOnlyUpdate },
    },
    {
      name: 'emailDomainDnsInstructions',
      type: 'ui',
      admin: {
        components: { Field: '@/components/admin/EmailDomainDnsInstructions' },
      },
    },
    {
      name: 'resendDomainId',
      type: 'text',
      required: false,
      index: true,
      admin: {
        hidden: true,
        description: 'Resend Domains API id for this tenant custom domain (set by hooks/API).',
      },
      access: { update: adminOnlyUpdate },
    },
    {
      name: 'emailDomainStatus',
      type: 'select',
      required: false,
      options: [...EMAIL_DOMAIN_STATUS_OPTIONS],
      defaultValue: 'not_configured',
      admin: {
        hidden: true,
        description: 'Resend email sending domain verification status (shown in Email sending domain panel).',
      },
      access: { update: adminOnlyUpdate },
    },
    {
      name: 'emailDomainVerifiedAt',
      type: 'date',
      required: false,
      admin: {
        hidden: true,
        description: 'When the Resend sending domain was last verified.',
      },
      access: { update: adminOnlyUpdate },
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
        description: 'Extra blocks this tenant can use on pages. Default blocks (Hero, Hero Schedule, About, Schedule, Content, CTA, Form, Gift voucher checkout, Event) are always available.',
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
    {
      name: 'onboardingSiteViewedAt',
      type: 'date',
      required: false,
      admin: {
        description: 'When the tenant admin first opened their public site from the onboarding checklist.',
        position: 'sidebar',
        readOnly: true,
      },
      access: {
        read: ({ req }) => Boolean(req?.user && checkRole(['super-admin', 'admin'], req.user as SharedUser)),
        update: adminOnlyUpdate,
      },
    },
    {
      name: 'checkoutLegalDocuments',
      type: 'array',
      label: 'Checkout legal documents',
      fields: [
        {
          name: 'page',
          type: 'relationship',
          relationTo: 'pages',
          required: true,
          label: 'Page',
        },
      ],
      admin: {
        description:
          'Pages linked below the drop-in payment form. Customers see: "By placing your booking, you agree to our …" — link text uses each page title. Drop-in only; membership and class pass checkout is handled by Stripe. Add as many pages as you need (e.g. booking terms, privacy policy, cancellation policy).',
        initCollapsed: false,
      },
    },
    {
      name: 'refundPolicy',
      type: 'group',
      label: 'Refund policy',
      admin: {
        description:
          'When a customer cancels a confirmed booking, whether drop-in money is refunded or class-pass credit is restored.',
      },
      fields: [
        {
          name: 'defaultWindowHours',
          type: 'number',
          required: false,
          min: 0,
          label: 'Default free cancellation window (hours)',
          admin: {
            description:
              'Applies to all payment methods unless overridden below. Leave empty for no automatic refunds.',
          },
        },
        {
          name: 'advanced',
          type: 'group',
          label: 'Advanced — payment method overrides',
          admin: {
            description:
              'Optional overrides per payment method. “Use default” inherits the default window. “Never” disables refunds for that method even if a default is set.',
          },
          fields: [
            {
              name: 'dropIn',
              type: 'group',
              label: 'Drop-in (Stripe)',
              fields: [
                {
                  name: 'mode',
                  type: 'select',
                  defaultValue: 'inherit',
                  options: [
                    { label: 'Use default', value: 'inherit' },
                    { label: 'Custom window', value: 'custom' },
                    { label: 'Never refund', value: 'never' },
                  ],
                },
                {
                  name: 'windowHours',
                  type: 'number',
                  min: 0,
                  admin: {
                    condition: (_: unknown, siblingData: { mode?: string }) =>
                      siblingData?.mode === 'custom',
                    description: 'Hours before start for drop-in Stripe refunds.',
                  },
                },
              ],
            },
            {
              name: 'classPass',
              type: 'group',
              label: 'Class pass',
              fields: [
                {
                  name: 'mode',
                  type: 'select',
                  defaultValue: 'inherit',
                  options: [
                    { label: 'Use default', value: 'inherit' },
                    { label: 'Custom window', value: 'custom' },
                    { label: 'Never restore credit', value: 'never' },
                  ],
                },
                {
                  name: 'windowHours',
                  type: 'number',
                  min: 0,
                  admin: {
                    condition: (_: unknown, siblingData: { mode?: string }) =>
                      siblingData?.mode === 'custom',
                    description: 'Hours before start for class-pass credit restore.',
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  ],
  hooks: {
    afterChange: [
      async ({ doc, previousDoc, operation, req, context }) => {
        if (context?.skipApexHook || context?.skipEmailDomainHook) return

        const connectedAccountId =
          typeof doc?.stripeConnectAccountId === 'string' && doc.stripeConnectAccountId.trim()
            ? doc.stripeConnectAccountId.trim()
            : null

        const register = async (domain: string, accountId?: string) => {
          await registerApplePayDomain(domain, accountId).catch((err: unknown) => {
            const label = accountId ? `(${accountId})` : '(platform)'
            console.error(
              `[Tenants afterChange] Failed to register Apple Pay domain "${domain}" ${label}:`,
              err,
            )
          })
        }

        const declaredDomains = applePayDomainsForDeclaration(doc)
        const previousDeclared =
          operation === 'create' || !previousDoc ? [] : applePayDomainsForDeclaration(previousDoc)
        const previousServing = new Set(previousDeclared)
        const servingChanged =
          operation === 'create' ||
          declaredDomains.length !== previousServing.size ||
          declaredDomains.some((host) => !previousServing.has(host))

        if (servingChanged) {
          for (const host of declaredDomains) {
            if (operation === 'create' || !previousServing.has(host)) {
              await register(host)
            }
          }
          if (connectedAccountId) {
            for (const host of declaredDomains) await register(host, connectedAccountId)
          }
        }

        // Named hostnames are registered as Cloudflare custom hostnames when they are saved.
        // An apex uses TXT validation. A hostname that leaves the list is not deleted here.
        for (const registration of customHostnamesToRegister({
          operation,
          hostnames: doc?.hostnames,
          previousHostnames: previousDoc?.hostnames,
        })) {
          await createOrGetCustomHostname(registration.hostname, registration.isApex).catch(
            (err: unknown) => {
              console.error(
                `[Tenants afterChange] Failed to register Cloudflare custom hostname "${registration.hostname}":`,
                err,
              )
            },
          )
        }

        // Resend email sending domain follows the apex of the canonical host.
        const newSendingDomain = resolveEmailSendingDomain(doc)
        const prevSendingDomain = previousDoc ? resolveEmailSendingDomain(previousDoc) : null
        const sendingDomainChanged = newSendingDomain !== prevSendingDomain
        const provisionCustomSendingDomain =
          Boolean(newSendingDomain) && !isPlatformEmailApex(newSendingDomain!)
        if (
          (operation === 'create' && provisionCustomSendingDomain) ||
          (operation !== 'create' && sendingDomainChanged)
        ) {
          const previousResendDomainId =
            typeof previousDoc?.resendDomainId === 'string' && previousDoc.resendDomainId.trim()
              ? previousDoc.resendDomainId.trim()
              : null
          await provisionTenantEmailDomain({
            payload: req.payload,
            tenantId: doc.id,
            newDomain: newSendingDomain,
            previousResendDomainId,
            req,
          })
        }

        void operation
      },
    ],
    beforeValidate: [
      async ({ data, operation, req, originalDoc }) => {
        if (!data) return data

        validateRawPublicHostInputs(data)

        if (operation === 'create' && !Object.prototype.hasOwnProperty.call(data, 'hostnames')) {
          data.hostnames = []
        }

        if (Object.prototype.hasOwnProperty.call(data, 'hostnames')) {
          if (data.hostnames == null) {
            data.hostnames = null
          } else if (!Array.isArray(data.hostnames)) {
            throw new Error('Hostname list must be a list of hostnames.')
          } else {
            data.hostnames = normalizeHostnameList(data.hostnames)
          }
        }

        if (
          Object.prototype.hasOwnProperty.call(data, 'direction') &&
          (data.direction == null || data.direction === '')
        ) {
          data.direction = DEFAULT_DIRECTION
        }

        const currentId = operation === 'update' && originalDoc?.id ? originalDoc.id : null
        await validateTenantPublicHostDeclarationOnSave({
          req,
          operation,
          tenantId: currentId,
          data,
          originalDoc,
        })

        return data
      },
    ],
  },
}

