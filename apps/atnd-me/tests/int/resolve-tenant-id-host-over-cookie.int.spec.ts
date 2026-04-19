import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import { resolveTenantIdFromRequest, type RequestLike } from '@/access/tenant-scoped'
import type { Tenant } from '@repo/shared-types'

const TEST_TIMEOUT = 60000
const HOOK_TIMEOUT = 300000

/**
 * Platform subdomains set tenant-slug with Domain=.<parent>; the browser sends that cookie on every
 * tenant host until Set-Cookie from the current response is applied. Tenant resolution must use
 * Host for the current request so SSR matches the site being viewed.
 */
describe('resolveTenantIdFromRequest: Host beats stale tenant-slug cookie', () => {
  let payload: Payload
  let tenantA: Tenant
  let tenantB: Tenant
  let prevServerUrl: string | undefined

  beforeAll(async () => {
    prevServerUrl = process.env.NEXT_PUBLIC_SERVER_URL
    process.env.NEXT_PUBLIC_SERVER_URL = 'https://platform-host-cookie.example.com'

    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    const ts = Date.now()
    tenantA = (await payload.create({
      collection: 'tenants',
      data: {
        name: 'Host priority A',
        slug: `host-prio-a-${ts}`,
      },
      overrideAccess: true,
    })) as Tenant

    tenantB = (await payload.create({
      collection: 'tenants',
      data: {
        name: 'Host priority B',
        slug: `host-prio-b-${ts}`,
      },
      overrideAccess: true,
    })) as Tenant
  }, HOOK_TIMEOUT)

  afterAll(async () => {
    if (payload) {
      try {
        await payload.delete({
          collection: 'tenants',
          where: { id: { in: [tenantA.id, tenantB.id] } },
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
    'prefers Host subdomain over tenant-slug cookie',
    async () => {
      const headers = new Headers()
      headers.set(
        'host',
        `${tenantB.slug}.platform-host-cookie.example.com`,
      )

      const reqLike: RequestLike = {
        context: {},
        headers,
        cookies: {
          get: (name: string) =>
            name === 'tenant-slug' ? { value: tenantA.slug } : undefined,
        },
        payload,
      }

      const id = await resolveTenantIdFromRequest(reqLike)
      expect(id).toBe(tenantB.id)
    },
    TEST_TIMEOUT,
  )
})
