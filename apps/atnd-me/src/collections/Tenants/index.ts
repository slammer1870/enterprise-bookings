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
  isCustomDomainDnsValidationEnabled,
  normalizeCustomDomain,
  validateCustomDomainDns,
  validateCustomDomainFormat,
  validateCustomDomainNotPlatform,
} from '@/utilities/validateCustomDomain'
import { registerApplePayDomain } from './registerApplePayDomain'
import { collectApexActionsFromHookArgs } from './apexDomainHook'
import { createOrGetCustomHostname } from '@/lib/cloudflare/customHostnames'
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
      name: 'domainDnsInstructions',
      type: 'ui',
      admin: {
        condition: (data) => Boolean(data?.domain),
        components: { Field: '@/components/admin/DomainDnsInstructions' },
      },
    },
    {
      name: 'redirectApex',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description:
          'Redirect the bare apex domain (e.g. example.com) to this subdomain. Recommended for www.* domains. Use with care for other subdomains if the apex is a separate website.',
        condition: (data) => {
          const d = typeof data?.domain === 'string' ? data.domain : ''
          return d.includes('.') && d.split('.').length >= 3
        },
      },
    },
    {
      name: 'apexDomain',
      type: 'text',
      required: false,
      index: true,
      admin: { hidden: true },
      access: { update: adminOnlyUpdate },
    },
    {
      name: 'apexDomainVerificationToken',
      type: 'text',
      required: false,
      admin: { hidden: true },
      access: { update: adminOnlyUpdate },
    },
    {
      name: 'apexDnsInstructions',
      type: 'ui',
      admin: {
        condition: (data) => Boolean(data?.redirectApex),
        components: { Field: '@/components/admin/ApexDnsInstructions' },
      },
    },
    {
      name: 'emailDomainDnsInstructions',
      type: 'ui',
      admin: {
        condition: (data) => Boolean(data?.domain),
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
        const rootHostname = (() => {
          const url = process.env.NEXT_PUBLIC_SERVER_URL
          if (!url) return null
          try { return new URL(url).hostname.toLowerCase() } catch { return null }
        })()

        const newSlug = typeof doc?.slug === 'string' ? doc.slug.trim() : null
        const prevSlug = typeof previousDoc?.slug === 'string' ? previousDoc.slug.trim() : null
        const newDomain =
          typeof doc?.domain === 'string' && doc.domain.trim() ? doc.domain.trim() : null
        const prevDomain =
          typeof previousDoc?.domain === 'string' && previousDoc.domain.trim()
            ? previousDoc.domain.trim()
            : null

        const connectedAccountId =
          typeof doc?.stripeConnectAccountId === 'string' && doc.stripeConnectAccountId.trim()
            ? doc.stripeConnectAccountId.trim()
            : null

        // Domains to register on the platform — only what actually changed.
        const platformDomains: string[] = []
        if (newSlug && rootHostname && (operation === 'create' || newSlug !== prevSlug)) {
          platformDomains.push(`${newSlug}.${rootHostname}`)
        }
        if (newDomain && newDomain !== prevDomain) {
          platformDomains.push(newDomain)
        }

        // Domains to register on the connected account — all current domains whenever
        // anything changes. This means any save (including the two-save temp-domain trick)
        // keeps the connected account fully in sync, closing the gap where only the custom
        // domain changed but the platform subdomain was never registered on the account.
        const connectedDomains: string[] = []
        if (connectedAccountId && (platformDomains.length > 0)) {
          if (newSlug && rootHostname) connectedDomains.push(`${newSlug}.${rootHostname}`)
          if (newDomain) connectedDomains.push(newDomain)
        }

        const register = async (domain: string, accountId?: string) => {
          await registerApplePayDomain(domain, accountId).catch((err: unknown) => {
            const label = accountId ? `(${accountId})` : '(platform)'
            console.error(
              `[Tenants afterChange] Failed to register Apple Pay domain "${domain}" ${label}:`,
              err,
            )
          })
        }

        for (const domain of platformDomains) await register(domain)
        for (const domain of connectedDomains) await register(domain, connectedAccountId!)

        // If the domain was cleared, no deregistration needed — Stripe doesn't expose a
        // paymentMethodDomains.delete() that would break other integrations on the same domain.

        // Main custom domain: register as a Cloudflare TLS for SaaS custom hostname.
        // CNAME DCV means the client only needs one DNS record (CNAME → platform subdomain)
        // and Cloudflare verifies ownership automatically — no TXT token needed.
        const apexActions = collectApexActionsFromHookArgs({ doc, previousDoc, operation })
        if (apexActions.registerDomain) {
          await createOrGetCustomHostname(apexActions.registerDomain, false).catch((err: unknown) => {
            console.error(
              `[Tenants afterChange] Failed to register Cloudflare custom hostname "${apexActions.registerDomain}":`,
              err,
            )
          })
        }

        // Apex domain: register with Apple Pay, register with Cloudflare TLS for SaaS
        // (so Cloudflare issues and manages the SSL cert regardless of hosting platform),
        // and store in DB when redirectApex is on.
        if (apexActions.registerApexApplePay) {
          await registerApplePayDomain(apexActions.registerApexApplePay).catch((err: unknown) => {
            console.error(
              `[Tenants afterChange] Failed to register Apple Pay domain "${apexActions.registerApexApplePay}":`,
              err,
            )
          })
          // Register apex with Cloudflare TLS for SaaS using TXT DCV.
          // Cloudflare issues and auto-renews the cert independently of the hosting platform —
          // switching to serverless only requires updating the Cloudflare fallback origin.
          const cfApexResult = await createOrGetCustomHostname(
            apexActions.registerApexApplePay,
            true,
          ).catch((err: unknown) => {
            console.error(
              `[Tenants afterChange] Failed to register Cloudflare apex hostname "${apexActions.registerApexApplePay}":`,
              err,
            )
            return null
          })
          await req.payload.update({
            collection: 'tenants',
            id: doc.id,
            data: {
              apexDomain: apexActions.apexDomainToStore,
              // Store the TXT DCV token so the admin UI can show it to the tenant.
              apexDomainVerificationToken: cfApexResult?.verificationTxtValue ?? null,
            },
            req,
            overrideAccess: true,
            context: { skipApexHook: true },
          }).catch((err: unknown) => {
            console.error('[Tenants afterChange] Failed to store apexDomain:', err)
          })
        } else if (apexActions.clearApex) {
          await req.payload.update({
            collection: 'tenants',
            id: doc.id,
            data: { apexDomain: null, apexDomainVerificationToken: null },
            req,
            overrideAccess: true,
            context: { skipApexHook: true },
          })
        }

        // Resend email sending domain: provision on create when a custom domain is set,
        // or whenever domain changes (including clear → teardown).
        const domainChanged = newDomain !== prevDomain
        if ((operation === 'create' && newDomain) || (operation !== 'create' && domainChanged)) {
          const previousResendDomainId =
            typeof previousDoc?.resendDomainId === 'string' && previousDoc.resendDomainId.trim()
              ? previousDoc.resendDomainId.trim()
              : null
          await provisionTenantEmailDomain({
            payload: req.payload,
            tenantId: doc.id,
            newDomain,
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

        // Only touch domain when it was included in this write. Partial updates
        // (e.g. Stripe Connect callback) must not clear an existing custom domain.
        if (!Object.prototype.hasOwnProperty.call(data, 'domain')) {
          return data
        }

        // Normalize "removed custom domain" to `null` so Payload actually persists
        // the cleared value. (Using `undefined` typically means "don't update this field".)
        if (data.domain == null || data.domain === '') {
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

