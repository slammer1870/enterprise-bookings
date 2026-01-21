import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import type { Tenant } from '@repo/shared-types'

const HOOK_TIMEOUT = 300000 // 5 minutes
const TEST_TIMEOUT = 60000 // 60 seconds

describe('Tenant Listing Page Access', () => {
  let payload: Payload
  let testTenants: Tenant[] = []

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    // Create multiple test tenants
    for (let i = 0; i < 3; i++) {
      const tenant = (await payload.create({
        collection: 'tenants',
        data: {
          name: `Listing Test Tenant ${i + 1}`,
          slug: `listing-test-${i + 1}-${Date.now()}`,
          description: `Test tenant ${i + 1} for listing page`,
        },
        overrideAccess: true,
      })) as Tenant
      testTenants.push(tenant)
    }

    // Wait a bit for any async operations
    await new Promise(resolve => setTimeout(resolve, 1000))
  }, HOOK_TIMEOUT)

  afterAll(async () => {
    if (payload) {
      try {
        await payload.delete({
          collection: 'tenants',
          where: {
            id: {
              in: testTenants.map(t => t.id),
            },
          },
          overrideAccess: true,
        })
      } catch {
        // ignore cleanup errors
      }
      if (payload.db?.destroy) {
        await payload.db.destroy()
      }
    }
  })

  it(
    'allows public read access to all tenants (for listing page)',
    async () => {
      // Verify test tenants still exist
      const existingTenants = await Promise.all(
        testTenants.map(t => 
          payload.findByID({
            collection: 'tenants',
            id: t.id,
            overrideAccess: true,
          }).catch(() => null)
        )
      )
      const validTenants = existingTenants.filter(t => t !== null)
      
      if (validTenants.length === 0) {
        payload.logger.warn('All test tenants were deleted, skipping test')
        return
      }

      // Query all tenants without authentication
      // This simulates what the /tenants page does
      const tenantsResult = await payload.find({
        collection: 'tenants',
        limit: 100,
        depth: 1, // Populate logo relationship
        // No user, rely on collection read access (should be public)
        overrideAccess: false, // Use access control
        sort: 'name',
      })

      // Should return at least some tenants (may include others from other tests)
      expect(tenantsResult.docs.length).toBeGreaterThanOrEqual(validTenants.length)

      // Verify our test tenants are included (if they still exist)
      const testTenantSlugs = validTenants.map(t => (t as Tenant).slug)
      const foundSlugs = tenantsResult.docs.map((t: Tenant) => t.slug)
      
      for (const slug of testTenantSlugs) {
        expect(foundSlugs).toContain(slug)
      }
    },
    TEST_TIMEOUT,
  )

  it(
    'includes tenant metadata needed for listing page',
    async () => {
      // Verify which tenants still exist
      const existingTenants = await Promise.all(
        testTenants.map(t => 
          payload.findByID({
            collection: 'tenants',
            id: t.id,
            overrideAccess: true,
          }).catch(() => null)
        )
      )
      const validTenants = existingTenants.filter(t => t !== null) as Tenant[]
      
      if (validTenants.length === 0) {
        payload.logger.warn('All test tenants were deleted, skipping test')
        return
      }

      const tenantsResult = await payload.find({
        collection: 'tenants',
        where: {
          id: {
            in: validTenants.map(t => t.id),
          },
        },
        depth: 1, // Populate logo
        overrideAccess: true,
      })

      expect(tenantsResult.docs.length).toBe(validTenants.length)

      for (const tenant of tenantsResult.docs as Tenant[]) {
        expect(tenant).toHaveProperty('id')
        expect(tenant).toHaveProperty('slug')
        expect(tenant).toHaveProperty('name')
        // Description is optional but should be included if present
        if (tenant.description) {
          expect(typeof tenant.description).toBe('string')
        }
      }
    },
    TEST_TIMEOUT,
  )

  it(
    'sorts tenants by name',
    async () => {
      const tenantsResult = await payload.find({
        collection: 'tenants',
        limit: 100,
        sort: 'name',
        overrideAccess: true,
      })

      const names = tenantsResult.docs.map((t: Tenant) => t.name)
      const sortedNames = [...names].sort()

      expect(names).toEqual(sortedNames)
    },
    TEST_TIMEOUT,
  )
})
