import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import type { Tenant } from '@repo/shared-types'
import { getNavbarForRequest, getFooterForRequest } from '@/utilities/getNavbarFooterForRequest'

/**
 * Step 4 - Frontend Header/Footer migration to Navbar/Footer collections
 *
 * Tests that navbar and footer are fetched from collections when tenant context exists.
 */
const HOOK_TIMEOUT = 300000
const TEST_TIMEOUT = 60000

describe('Frontend navbar/footer migration (tenant-aware)', () => {
  let payload: Payload
  let testTenant: Tenant

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    testTenant = (await payload.create({
      collection: 'tenants',
      data: {
        name: 'Navbar Footer Test Tenant',
        slug: `nav-footer-${Date.now()}`,
      },
      overrideAccess: true,
    })) as Tenant

    // Wait for tenant onboarding hook to create default navbar/footer
    await new Promise((r) => setTimeout(r, 2000))
  }, HOOK_TIMEOUT)

  afterAll(async () => {
    if (payload) {
      try {
        await payload.delete({
          collection: 'tenants',
          id: testTenant.id,
          overrideAccess: true,
        })
      } catch {
        // ignore
      }
      await payload.db?.destroy?.()
    }
  })

  it(
    'returns tenant navbar when tenant context exists',
    async () => {
      const cookies = {
        get: (name: string) =>
          name === 'tenant-slug' ? { value: testTenant.slug } : undefined,
      }
      const navbar = await getNavbarForRequest(payload, { cookies })
      expect(navbar).not.toBeNull()
      expect(navbar?.logoLink).toBeDefined()
      expect(navbar?.navItems).toBeDefined()
    },
    TEST_TIMEOUT,
  )

  it(
    'returns tenant footer when tenant context exists',
    async () => {
      const cookies = {
        get: (name: string) =>
          name === 'tenant-slug' ? { value: testTenant.slug } : undefined,
      }
      const footer = await getFooterForRequest(payload, { cookies })
      expect(footer).not.toBeNull()
      expect(footer?.logoLink).toBeDefined()
      expect(footer?.navItems).toBeDefined()
    },
    TEST_TIMEOUT,
  )

  it(
    'returns fallback when no tenant context (root domain)',
    async () => {
      const cookies = { get: () => undefined }
      const navbar = await getNavbarForRequest(payload, { cookies })
      const footer = await getFooterForRequest(payload, { cookies })
      expect(navbar).not.toBeNull()
      expect(footer).not.toBeNull()
      expect(navbar?.navItems).toEqual([])
      expect(navbar?.logoLink).toBe('/')
    },
    TEST_TIMEOUT,
  )
})
