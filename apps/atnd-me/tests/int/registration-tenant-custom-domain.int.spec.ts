import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import { createTRPCContext } from '@repo/trpc'
import { appRouter } from '@/trpc/router'
import { ATND_ME_BOOKINGS_COLLECTION_SLUGS } from '@/constants/bookings-collection-slugs'
import { getTenantContext } from '@/utilities/getTenantContext'
import { resolveRegistrationTenantIdForRequest } from '@/trpc/resolveRegistrationTenantId'
import { resolveTenantIdFromRequest, type RequestLike } from '@/access/tenant-scoped'
import type { Tenant, User } from '@repo/shared-types'

const TEST_TIMEOUT = 60000
const HOOK_TIMEOUT = 300000

/**
 * Registration and tenant resolution when the public host is a tenant custom domain.
 * Covers mis-ordered proxy headers (x-forwarded-host vs Host) and passwordless signup.
 */
describe('Registration tenant (custom domain)', () => {
  let payload: Payload
  let tenant: Tenant
  const customDomain = `book-reg-${Date.now()}.reg-int.example.com`
  const platformUrl = 'https://atnd-platform-int.example.com'
  let prevServerUrl: string | undefined

  beforeAll(async () => {
    prevServerUrl = process.env.NEXT_PUBLIC_SERVER_URL
    process.env.NEXT_PUBLIC_SERVER_URL = platformUrl

    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    tenant = (await payload.create({
      collection: 'tenants',
      data: {
        name: 'Reg test tenant',
        slug: `reg-test-${Date.now()}`,
        domain: customDomain,
      },
      overrideAccess: true,
    })) as Tenant
  }, HOOK_TIMEOUT)

  afterAll(async () => {
    if (payload) {
      try {
        await payload.delete({
          collection: 'tenants',
          where: { id: { equals: tenant.id } },
          overrideAccess: true,
        })
      } catch {
        // ignore
      }
      await payload.db?.destroy?.()
    }
    if (prevServerUrl !== undefined) {
      process.env.NEXT_PUBLIC_SERVER_URL = prevServerUrl
    } else {
      delete process.env.NEXT_PUBLIC_SERVER_URL
    }
  })

  it(
    'getTenantContext resolves tenant when x-forwarded-host is platform but Host is custom domain',
    async () => {
      const headers = new Headers()
      headers.set('x-forwarded-host', new URL(platformUrl).hostname)
      headers.set('host', customDomain)

      const ctx = await getTenantContext(payload, { headers })
      expect(ctx).not.toBeNull()
      expect(ctx!.id).toBe(tenant.id)
      expect(ctx!.slug).toBe(tenant.slug)
    },
    TEST_TIMEOUT,
  )

  it(
    'resolveRegistrationTenantIdForRequest matches getTenantContext for proxy header mismatch',
    async () => {
      const headers = new Headers()
      headers.set('x-forwarded-host', new URL(platformUrl).hostname)
      headers.set('host', customDomain)

      const id = await resolveRegistrationTenantIdForRequest({ payload, headers })
      expect(id).toBe(tenant.id)
    },
    TEST_TIMEOUT,
  )

  it(
    'resolveTenantIdFromRequest finds tenant id from Host when forwarded-host is platform',
    async () => {
      const headers = new Headers()
      headers.set('x-forwarded-host', new URL(platformUrl).hostname)
      headers.set('host', customDomain)

      const reqLike: RequestLike = {
        context: {},
        headers,
        cookies: { get: () => undefined },
        payload,
      }

      const id = await resolveTenantIdFromRequest(reqLike)
      expect(id).toBe(tenant.id)
    },
    TEST_TIMEOUT,
  )

  it(
    'auth.registerPasswordless sets registrationTenant when resolver is wired',
    async () => {
      const headers = new Headers()
      headers.set('x-forwarded-host', new URL(platformUrl).hostname)
      headers.set('host', customDomain)

      const email = `reg-custom-${Date.now()}@example.com`
      const ctx = await createTRPCContext({
        headers,
        payload,
        bookingsCollectionSlugs: ATND_ME_BOOKINGS_COLLECTION_SLUGS,
        resolveRegistrationTenantId: resolveRegistrationTenantIdForRequest,
      })

      const caller = appRouter.createCaller(ctx)
      await caller.auth.registerPasswordless({
        name: 'Custom Domain Registrant',
        email,
      })

      const found = await payload.find({
        collection: 'users',
        where: { email: { equals: email } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })

      expect(found.docs.length).toBe(1)
      const user = found.docs[0] as User
      const reg = user.registrationTenant
      const regId = typeof reg === 'object' && reg !== null && 'id' in reg ? (reg as { id: number }).id : reg
      expect(regId).toBe(tenant.id)

      await payload.delete({
        collection: 'users',
        where: { id: { equals: user.id } },
        overrideAccess: true,
      })
    },
    TEST_TIMEOUT,
  )
})
