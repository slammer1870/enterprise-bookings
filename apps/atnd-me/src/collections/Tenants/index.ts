import type { CollectionConfig } from 'payload'
import { checkRole } from '@repo/shared-utils'
import type { User as SharedUser } from '@repo/shared-types'
import { getUserTenantIds } from '@/access/tenant-scoped'
import { tenantOrgPayloadAdminAccess } from '@/access/userTenantAccess'
import { isValidTimeZone } from '@repo/shared-utils'
import { bookingThemeField } from '@/fields/bookingThemeFields'
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
    bookingThemeField,
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
    afterChange: [
      async ({ doc, previousDoc, operation, req, context }) => {
        if (context?.skipApexHook) return
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

        void operation
      },
    ],
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

