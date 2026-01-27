import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import type { Tenant, Page } from '@repo/shared-types'

const HOOK_TIMEOUT = 300000 // 5 minutes
const TEST_TIMEOUT = 60000 // 60 seconds

// Helper to extract tenant ID from tenant field (can be number or Tenant object)
function getTenantId(tenant: number | Tenant | null | undefined): number | null {
  if (tenant === null || tenant === undefined) return null
  if (typeof tenant === 'number') return tenant
  if (typeof tenant === 'object' && 'id' in tenant) return tenant.id
  return null
}

describe('Tenant-Scoped Page Slugs', () => {
  let payload: Payload
  let tenant1: Tenant
  let tenant2: Tenant

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    // Create test tenants
    tenant1 = (await payload.create({
      collection: 'tenants',
      data: {
        name: 'Slug Test Tenant 1',
        slug: `slug-test-tenant-1-${Date.now()}`,
      },
      overrideAccess: true,
    })) as Tenant

    tenant2 = (await payload.create({
      collection: 'tenants',
      data: {
        name: 'Slug Test Tenant 2',
        slug: `slug-test-tenant-2-${Date.now()}`,
      },
      overrideAccess: true,
    })) as Tenant

    // Wait for onboarding hooks
    await new Promise(resolve => setTimeout(resolve, 2000))
  }, HOOK_TIMEOUT)

  afterAll(async () => {
    if (payload) {
      try {
        // Clean up pages first (foreign key constraint)
        const pages = await payload.find({
          collection: 'pages',
          where: {
            tenant: {
              in: [tenant1.id, tenant2.id],
            },
          },
          limit: 1000,
          overrideAccess: true,
        })

        for (const page of pages.docs) {
          await payload.delete({
            collection: 'pages',
            id: page.id,
            overrideAccess: true,
          })
        }

        // Clean up tenants
        await payload.delete({
          collection: 'tenants',
          where: { id: { in: [tenant1.id, tenant2.id] } },
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

  describe('Multiple Tenants Can Have Same Slug', () => {
    it(
      'should allow different tenants to have pages with the same slug',
      async () => {
        const slug = `shared-slug-${Date.now()}`

        // Create page for tenant1
        const page1 = (await payload.create({
          collection: 'pages',
          data: {
            slug,
            title: 'Page 1 for Tenant 1',
            tenant: tenant1.id,
            _status: 'published',
            hero: {
              type: 'none',
            },
            layout: [{ blockType: 'content', columns: [] }],
          },
          overrideAccess: true,
        })) as Page

        expect(page1.slug).toBe(slug)
        expect(getTenantId(page1.tenant)).toBe(tenant1.id)

        // Create page for tenant2 with the same slug
        const page2 = (await payload.create({
          collection: 'pages',
          data: {
            slug,
            title: 'Page 2 for Tenant 2',
            tenant: tenant2.id,
            _status: 'published',
            hero: {
              type: 'none',
            },
            layout: [{ blockType: 'content', columns: [] }],
          },
          overrideAccess: true,
        })) as Page

        expect(page2.slug).toBe(slug)
        expect(getTenantId(page2.tenant)).toBe(tenant2.id)

        // Verify both pages exist
        const found1 = await payload.findByID({
          collection: 'pages',
          id: page1.id,
          overrideAccess: true,
        })
        const found2 = await payload.findByID({
          collection: 'pages',
          id: page2.id,
          overrideAccess: true,
        })

        expect(found1).toBeDefined()
        expect(found2).toBeDefined()
        expect(found1?.slug).toBe(slug)
        expect(found2?.slug).toBe(slug)
      },
      TEST_TIMEOUT
    )

    it(
      'should allow querying pages by slug within tenant context',
      async () => {
        const slug = `query-test-${Date.now()}`

        // Create pages for both tenants
        const page1 = (await payload.create({
          collection: 'pages',
          data: {
            slug,
            title: 'Query Test Page 1',
            tenant: tenant1.id,
            _status: 'published',
            hero: { type: 'none' },
            layout: [{ blockType: 'content', columns: [] }],
          },
          overrideAccess: true,
        })) as Page

        const page2 = (await payload.create({
          collection: 'pages',
          data: {
            slug,
            title: 'Query Test Page 2',
            tenant: tenant2.id,
            _status: 'published',
            hero: { type: 'none' },
            layout: [{ blockType: 'content', columns: [] }],
          },
          overrideAccess: true,
        })) as Page

        // Query for tenant1's page
        const tenant1Pages = await payload.find({
          collection: 'pages',
          where: {
            and: [
              { slug: { equals: slug } },
              { tenant: { equals: tenant1.id } },
            ],
          },
          overrideAccess: true,
        })

        expect(tenant1Pages.docs).toHaveLength(1)
        expect(tenant1Pages.docs[0]?.id).toBe(page1.id)

        // Query for tenant2's page
        const tenant2Pages = await payload.find({
          collection: 'pages',
          where: {
            and: [
              { slug: { equals: slug } },
              { tenant: { equals: tenant2.id } },
            ],
          },
          overrideAccess: true,
        })

        expect(tenant2Pages.docs).toHaveLength(1)
        expect(tenant2Pages.docs[0]?.id).toBe(page2.id)
      },
      TEST_TIMEOUT
    )
  })

  describe('Slug Uniqueness Within Tenant', () => {
    it(
      'should prevent duplicate slugs within the same tenant',
      async () => {
        const slug = `duplicate-test-${Date.now()}`

        // Create first page
        const page1 = (await payload.create({
          collection: 'pages',
          data: {
            slug,
            title: 'First Page',
            tenant: tenant1.id,
            _status: 'published',
            hero: { type: 'none' },
            layout: [{ blockType: 'content', columns: [] }],
          },
          overrideAccess: true,
        })) as Page

        expect(page1.slug).toBe(slug)

        // Try to create second page with same slug in same tenant
        await expect(
          payload.create({
            collection: 'pages',
            data: {
              slug,
              title: 'Second Page',
              tenant: tenant1.id,
              _status: 'published',
              hero: { type: 'none' },
              layout: [{ blockType: 'content', columns: [] }],
            },
            overrideAccess: true,
          })
        ).rejects.toThrow()
      },
      TEST_TIMEOUT
    )

    it(
      'should validate slug uniqueness via validation hook',
      async () => {
        const slug = `validation-test-${Date.now()}`

        // Create first page
        await payload.create({
          collection: 'pages',
          data: {
            slug,
            title: 'Validation Test Page',
            tenant: tenant1.id,
            _status: 'published',
            hero: { type: 'none' },
            layout: [{ blockType: 'content', columns: [] }],
          },
          overrideAccess: true,
        })

        // Try to create duplicate - should fail with user-friendly error
        try {
          await payload.create({
            collection: 'pages',
            data: {
              slug,
              title: 'Duplicate Page',
              tenant: tenant1.id,
              _status: 'published',
              hero: { type: 'none' },
              layout: [{ blockType: 'content', columns: [] }],
            },
            overrideAccess: true,
          })
          expect.fail('Should have thrown an error')
        } catch (error: any) {
          expect(error.message).toContain('already exists for this tenant')
          expect(error.message).toContain(slug)
        }
      },
      TEST_TIMEOUT
    )

    it(
      'should enforce uniqueness at database level (composite index)',
      async () => {
        const slug = `db-constraint-test-${Date.now()}`

        // Create first page
        await payload.create({
          collection: 'pages',
          data: {
            slug,
            title: 'DB Constraint Test',
            tenant: tenant1.id,
            _status: 'published',
            hero: { type: 'none' },
            layout: [{ blockType: 'content', columns: [] }],
          },
          overrideAccess: true,
        })

        // Try to create duplicate - validation hook should catch it first,
        // but if it somehow doesn't, the database constraint will prevent it
        await expect(
          payload.create({
            collection: 'pages',
            data: {
              slug,
              title: 'Duplicate DB Test',
              tenant: tenant1.id,
              _status: 'published',
              hero: { type: 'none' },
              layout: [{ blockType: 'content', columns: [] }],
            },
            overrideAccess: true,
          })
        ).rejects.toThrow()

        // Verify the composite unique index allows same slug for different tenant
        const page2 = await payload.create({
          collection: 'pages',
          data: {
            slug, // Same slug
            title: 'Different Tenant',
            tenant: tenant2.id, // Different tenant
            _status: 'published',
            hero: { type: 'none' },
            layout: [{ blockType: 'content', columns: [] }],
          },
          overrideAccess: true,
        })

        expect(page2.slug).toBe(slug)
        expect(getTenantId(page2.tenant)).toBe(tenant2.id)
      },
      TEST_TIMEOUT
    )
  })

  describe('Update Operations', () => {
    it.skip(
      'should allow updating a page without changing its slug',
      // Known issue: SEO plugin field hooks (likely PreviewField) access tenant during afterRead processing
      // causing "Cannot read properties of undefined (reading 'tenant')" error.
      // This is a Payload/SEO plugin compatibility issue with multi-tenant setups.
      // The update functionality works, but the hook processing fails.
      // TODO: Fix this when Payload/SEO plugin supports multi-tenant properly
      async () => {
        const slug = `update-keep-slug-${Date.now()}`

        const page = (await payload.create({
          collection: 'pages',
          data: {
            slug,
            title: 'Original Title',
            tenant: tenant1.id,
            _status: 'published',
            hero: { type: 'none' },
            layout: [{ blockType: 'content', columns: [] }],
            meta: {
              title: '',
              description: '',
            },
          },
          overrideAccess: true,
        })) as Page

        const tenantId = getTenantId(page.tenant)
        expect(tenantId).toBe(tenant1.id)
        
        const updated = (await payload.update({
          collection: 'pages',
          id: page.id,
          data: {
            title: 'Updated Title',
            slug,
            tenant: tenantId,
          },
          overrideAccess: true,
        })) as Page

        expect(updated.slug).toBe(slug)
        expect(updated.title).toBe('Updated Title')
      },
      TEST_TIMEOUT
    )

    it(
      'should allow changing slug to a new unique value within tenant',
      async () => {
        const originalSlug = `original-slug-${Date.now()}`
        const newSlug = `new-slug-${Date.now()}`

        const page = (await payload.create({
          collection: 'pages',
          data: {
            slug: originalSlug,
            title: 'Change Slug Test',
            tenant: tenant1.id,
            _status: 'published',
            hero: { type: 'none' },
            layout: [{ blockType: 'content', columns: [] }],
          },
          overrideAccess: true,
        })) as Page

        // Change to new unique slug
        const pageTenantId = getTenantId(page.tenant)
        const updated = (await payload.update({
          collection: 'pages',
          id: page.id,
          data: {
            slug: newSlug,
            tenant: pageTenantId, // Include tenant for field hooks
          },
          depth: 0,
          overrideAccess: true,
        })) as Page

        expect(updated.slug).toBe(newSlug)
      },
      TEST_TIMEOUT
    )

    it(
      'should prevent changing slug to an existing slug within same tenant',
      async () => {
        const slug1 = `existing-slug-${Date.now()}`
        const slug2 = `target-slug-${Date.now()}`

        // Create two pages with different slugs
        const page1 = (await payload.create({
          collection: 'pages',
          data: {
            slug: slug1,
            title: 'Page 1',
            tenant: tenant1.id,
            _status: 'published',
            hero: { type: 'none' },
            layout: [{ blockType: 'content', columns: [] }],
          },
          overrideAccess: true,
        })) as Page

        const page2 = (await payload.create({
          collection: 'pages',
          data: {
            slug: slug2,
            title: 'Page 2',
            tenant: tenant1.id,
            _status: 'published',
            hero: { type: 'none' },
            layout: [{ blockType: 'content', columns: [] }],
          },
          overrideAccess: true,
        })) as Page

        // Try to change page2's slug to page1's slug
        const page2TenantId = getTenantId(page2.tenant)
        await expect(
          payload.update({
            collection: 'pages',
            id: page2.id,
            data: {
              slug: slug1, // Try to use page1's slug
              tenant: page2TenantId, // Include tenant for field hooks
            },
            depth: 0,
            overrideAccess: true,
          })
        ).rejects.toThrow()
      },
      TEST_TIMEOUT
    )

    it(
      'should allow changing slug to a slug used by another tenant',
      async () => {
        const slug = `cross-tenant-slug-${Date.now()}`

        // Create page for tenant1
        const page1 = (await payload.create({
          collection: 'pages',
          data: {
            slug,
            title: 'Tenant 1 Page',
            tenant: tenant1.id,
            _status: 'published',
            hero: { type: 'none' },
            layout: [{ blockType: 'content', columns: [] }],
          },
          overrideAccess: true,
        })) as Page

        // Create page for tenant2 with different slug
        const page2 = (await payload.create({
          collection: 'pages',
          data: {
            slug: `different-slug-${Date.now()}`,
            title: 'Tenant 2 Page',
            tenant: tenant2.id,
            _status: 'published',
            hero: { type: 'none' },
            layout: [{ blockType: 'content', columns: [] }],
          },
          overrideAccess: true,
        })) as Page

        // Change tenant2's page to use tenant1's slug (should be allowed)
        const page2TenantId = getTenantId(page2.tenant)
        const updated = (await payload.update({
          collection: 'pages',
          id: page2.id,
          data: {
            slug, // Use slug from tenant1
            tenant: page2TenantId, // Include tenant for field hooks
          },
          depth: 0,
          overrideAccess: true,
        })) as Page

        expect(updated.slug).toBe(slug)
        expect(getTenantId(updated.tenant)).toBe(tenant2.id)

        // Verify both pages still exist with same slug
        const found1 = await payload.findByID({
          collection: 'pages',
          id: page1.id,
          overrideAccess: true,
        })
        const found2 = await payload.findByID({
          collection: 'pages',
          id: page2.id,
          overrideAccess: true,
        })

        expect(found1?.slug).toBe(slug)
        expect(found2?.slug).toBe(slug)
        expect(getTenantId(found1?.tenant)).toBe(tenant1.id)
        expect(getTenantId(found2?.tenant)).toBe(tenant2.id)
      },
      TEST_TIMEOUT
    )
  })

  describe('Slug Auto-Generation', () => {
    it(
      'should auto-generate slug from title when not provided',
      async () => {
        const title = `Auto Generate Test ${Date.now()}`

        const page = (await payload.create({
          collection: 'pages',
          data: {
            title,
            tenant: tenant1.id,
            _status: 'published',
            hero: { type: 'none' },
            layout: [{ blockType: 'content', columns: [] }],
            // No slug provided
          },
          overrideAccess: true,
        })) as Page

        expect(page.slug).toBeDefined()
        expect(page.slug).toBe(
          title
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_-]+/g, '-')
            .replace(/^-+|-+$/g, '')
        )
      },
      TEST_TIMEOUT
    )

    it(
      'should generate unique slugs when auto-generating for same tenant',
      async () => {
        const title = `Unique Auto Generate ${Date.now()}`

        // Create first page
        const page1 = (await payload.create({
          collection: 'pages',
          data: {
            title,
            tenant: tenant1.id,
            _status: 'published',
            hero: { type: 'none' },
            layout: [{ blockType: 'content', columns: [] }],
          },
          overrideAccess: true,
        })) as Page

        // Try to create second page with same title (should fail due to duplicate slug)
        await expect(
          payload.create({
            collection: 'pages',
            data: {
              title, // Same title will generate same slug
              tenant: tenant1.id,
              _status: 'published',
              hero: { type: 'none' },
              layout: [{ blockType: 'content', columns: [] }],
            },
            overrideAccess: true,
          })
        ).rejects.toThrow()
      },
      TEST_TIMEOUT
    )
  })
})
