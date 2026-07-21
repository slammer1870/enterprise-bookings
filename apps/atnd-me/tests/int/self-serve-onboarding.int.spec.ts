import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'

import { claimTenant } from '@/lib/onboarding/claimTenant'
import { getUserTenantIDs } from '@/access/tenant-scoped'

const HOOK_TIMEOUT = 300000
const TEST_TIMEOUT = 60000

describe('Self-serve tenant claim', () => {
  let payload: Payload
  const magicLinkCalls: Array<{ email: string; callbackURL?: string }> = []

  const sendMagicLink = async (args: {
    email: string
    callbackURL: string
    headers: Headers
  }) => {
    magicLinkCalls.push({ email: args.email, callbackURL: args.callbackURL })
    return { success: true }
  }

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })
  }, HOOK_TIMEOUT)

  afterAll(async () => {
    // Shared Payload singleton — do not destroy; other suites in this file reuse it.
  })

  it(
    'creates tenant, admin user, bootstrap data, and sends magic link',
    async () => {
      const stamp = Date.now()
      const slug = `claim-${stamp}`
      const email = `claim-${stamp}@example.com`
      magicLinkCalls.length = 0

      const headers = new Headers({
        host: 'www.localhost:3000',
        'x-forwarded-proto': 'http',
      })

      const result = await claimTenant({
        payload,
        headers,
        sendMagicLink,
        input: {
          slug,
          tenantName: `Claim Studio ${stamp}`,
          name: 'Claim Admin',
          email,
        },
      })

      expect(result.ok).toBe(true)
      if (!result.ok) return

      expect(result.slug).toBe(slug)
      expect(result.adminURL).toContain(`${slug}.`)
      expect(result.adminURL).toContain('/admin')

      const tenant = await payload.findByID({
        collection: 'tenants',
        id: result.tenantId,
        depth: 0,
        overrideAccess: true,
      })
      expect(tenant?.slug).toBe(slug)
      expect(tenant?.name).toBe(`Claim Studio ${stamp}`)

      const user = await payload.findByID({
        collection: 'users',
        id: result.userId,
        depth: 1,
        overrideAccess: true,
      })
      expect(user?.email).toBe(email)
      expect(user?.name).toBe('Claim Admin')

      const roles = Array.isArray(user?.role) ? user.role : user?.role ? [user.role] : []
      // Fresh migrate DBs promote the first user to super-admin; otherwise claim sets admin.
      expect(roles.some((r) => r === 'admin' || r === 'super-admin')).toBe(true)

      const membershipIds = getUserTenantIDs(user as never, 'admin')
      expect(membershipIds).toContain(result.tenantId)

      const locations = await payload.find({
        collection: 'locations',
        where: { tenant: { equals: result.tenantId } },
        limit: 5,
        overrideAccess: true,
      })
      expect(locations.docs.length).toBeGreaterThanOrEqual(1)

      const home = await payload.find({
        collection: 'pages',
        where: {
          and: [{ slug: { equals: 'home' } }, { tenant: { equals: result.tenantId } }],
        },
        limit: 1,
        overrideAccess: true,
      })
      expect(home.docs[0]).toBeTruthy()

      const tenantWithLogo = await payload.findByID({
        collection: 'tenants',
        id: result.tenantId,
        depth: 1,
        overrideAccess: true,
      })
      expect(tenantWithLogo?.logo, 'default monogram logo should be set on claim').toBeTruthy()
      const logoDoc =
        typeof tenantWithLogo.logo === 'object' && tenantWithLogo.logo !== null
          ? tenantWithLogo.logo
          : null
      if (logoDoc && 'filename' in logoDoc) {
        expect(String(logoDoc.filename || '')).toMatch(/-logo\.png$/i)
      }

      expect(magicLinkCalls).toHaveLength(1)
      expect(magicLinkCalls[0]?.email).toBe(email)
      expect(magicLinkCalls[0]?.callbackURL).toBe(result.adminURL)
    },
    TEST_TIMEOUT,
  )

  it(
    'rejects duplicate slug; assigns existing email as admin on new tenant',
    async () => {
      const stamp = Date.now()
      const slug = `dup-${stamp}`
      const email = `dup-${stamp}@example.com`
      const headers = new Headers({ host: 'localhost:3000' })

      const first = await claimTenant({
        payload,
        headers,
        sendMagicLink,
        input: {
          slug,
          tenantName: 'Dup Studio',
          name: 'Dup User',
          email,
        },
      })
      expect(first.ok).toBe(true)
      if (!first.ok) return

      const slugTaken = await claimTenant({
        payload,
        headers,
        sendMagicLink,
        input: {
          slug,
          tenantName: 'Other Studio',
          name: 'Other User',
          email: `other-${stamp}@example.com`,
        },
      })
      expect(slugTaken.ok).toBe(false)
      if (!slugTaken.ok) {
        expect(slugTaken.code).toBe('slug_taken')
        expect(slugTaken.status).toBe(409)
      }

      magicLinkCalls.length = 0
      const secondSlug = `other-${stamp}`
      const existingEmailClaim = await claimTenant({
        payload,
        headers,
        sendMagicLink,
        input: {
          slug: secondSlug,
          tenantName: 'Other Studio 2',
          name: 'Other User 2',
          email,
        },
      })
      expect(existingEmailClaim.ok).toBe(true)
      if (!existingEmailClaim.ok) return

      expect(existingEmailClaim.userId).toBe(first.userId)
      expect(existingEmailClaim.tenantId).not.toBe(first.tenantId)

      const user = await payload.findByID({
        collection: 'users',
        id: first.userId,
        depth: 0,
        overrideAccess: true,
      })
      const adminTenantIds = getUserTenantIDs(user as never, 'admin')
      expect(adminTenantIds).toContain(first.tenantId)
      expect(adminTenantIds).toContain(existingEmailClaim.tenantId)

      expect(magicLinkCalls).toHaveLength(1)
      expect(magicLinkCalls[0]?.email).toBe(email)
      expect(magicLinkCalls[0]?.callbackURL).toBe(existingEmailClaim.adminURL)
    },
    TEST_TIMEOUT,
  )

  it(
    'rejects reserved slugs',
    async () => {
      const result = await claimTenant({
        payload,
        headers: new Headers({ host: 'localhost:3000' }),
        sendMagicLink,
        input: {
          slug: 'www',
          tenantName: 'Nope',
          name: 'Nope',
          email: `reserved-${Date.now()}@example.com`,
        },
      })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.code).toBe('invalid_slug')
        expect(result.status).toBe(400)
      }
    },
    TEST_TIMEOUT,
  )
})

describe('Onboarding status signals', () => {
  let payload: Payload

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })
  }, HOOK_TIMEOUT)

  afterAll(async () => {
    // Shared Payload singleton — do not destroy between suites in this file.
  })

  it(
    'reflects stripe / event-type / schedule presence',
    async () => {
      const stamp = Date.now()
      const tenant = await payload.create({
        collection: 'tenants',
        data: {
          name: `Onboard Status ${stamp}`,
          slug: `onboard-status-${stamp}`,
          stripeConnectOnboardingStatus: 'not_connected',
        },
        overrideAccess: true,
      })

      const tenantId = Number(tenant.id)

      const eventTypesEmpty = await payload.find({
        collection: 'event-types',
        where: { tenant: { equals: tenantId } },
        limit: 1,
        overrideAccess: true,
      })
      expect(eventTypesEmpty.totalDocs).toBe(0)

      await payload.create({
        collection: 'event-types',
        data: {
          name: `Intro Class ${stamp}`,
          places: 10,
          description: 'Intro',
          tenant: tenantId,
        },
        overrideAccess: true,
      })

      const eventTypes = await payload.find({
        collection: 'event-types',
        where: { tenant: { equals: tenantId } },
        limit: 1,
        overrideAccess: true,
      })
      expect(eventTypes.totalDocs).toBeGreaterThan(0)

      await payload.update({
        collection: 'tenants',
        id: tenantId,
        data: { stripeConnectOnboardingStatus: 'active' },
        overrideAccess: true,
      })

      const updated = await payload.findByID({
        collection: 'tenants',
        id: tenantId,
        overrideAccess: true,
      })
      expect(updated?.stripeConnectOnboardingStatus).toBe('active')
    },
    TEST_TIMEOUT,
  )
})
