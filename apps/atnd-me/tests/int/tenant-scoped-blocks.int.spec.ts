import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import type { Tenant, Page } from '@repo/shared-types'

const HOOK_TIMEOUT = 300000
const TEST_TIMEOUT = 60000

describe('Tenant-Scoped Blocks (Phase 3)', () => {
  let payload: Payload
  let tenantDefaultOnly: Tenant
  let tenantWithExtras: Tenant

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    tenantDefaultOnly = (await payload.create({
      collection: 'tenants',
      data: {
        name: 'Blocks Test Default Only',
        slug: `blocks-default-${Date.now()}`,
        allowedBlocks: [], // No extra blocks
      },
      overrideAccess: true,
    })) as Tenant

    tenantWithExtras = (await payload.create({
      collection: 'tenants',
      data: {
        name: 'Blocks Test With Extras',
        slug: `blocks-extras-${Date.now()}`,
        allowedBlocks: ['location'], // Extra block enabled (faqs is a default block for all tenants)
      },
      overrideAccess: true,
    })) as Tenant

    await new Promise(resolve => setTimeout(resolve, 2000))
  }, HOOK_TIMEOUT)

  afterAll(async () => {
    if (payload) {
      try {
        const pages = await payload.find({
          collection: 'pages',
          where: {
            or: [
              { tenant: { in: [tenantDefaultOnly.id, tenantWithExtras.id] } },
              { slug: { contains: 'global-location' } },
            ],
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
        await payload.delete({
          collection: 'tenants',
          where: { id: { in: [tenantDefaultOnly.id, tenantWithExtras.id] } },
          overrideAccess: true,
        })
      } catch {
        // ignore
      }
      if (payload.db?.destroy) {
        await payload.db.destroy()
      }
    }
  })

  it(
    'should allow page with default blocks only',
    async () => {
      const page = (await payload.create({
        collection: 'pages',
        data: {
          title: 'Default Blocks Page',
          slug: `default-blocks-${Date.now()}`,
          tenant: tenantDefaultOnly.id,
          layout: [
            { blockType: 'heroScheduleSanctuary', blockName: 'Homepage — hero with schedule', title: 'Welcome' },
          ],
          _status: 'published',
        },
        overrideAccess: true,
      })) as Page

      expect(page.layout).toHaveLength(1)
      expect(page.layout?.[0]?.blockType).toBe('heroScheduleSanctuary')
    },
    TEST_TIMEOUT,
  )

  it(
    'should allow page with tenant extra blocks when enabled',
    async () => {
      // Tenant has allowedBlocks: ['location', 'faqs']. faqs is also a default block for all tenants.
      const page = (await payload.create({
        collection: 'pages',
        data: {
          title: 'Extra Blocks Page',
          slug: `extra-blocks-${Date.now()}`,
          tenant: tenantWithExtras.id,
          layout: [{ blockType: 'content', blockName: 'Text section', content: { root: { type: 'root', children: [], direction: null, format: '', indent: 0, version: 1 } } }],
          _status: 'published',
        },
        overrideAccess: true,
      })) as Page

      expect(page.layout).toHaveLength(1)
      expect(page.layout?.[0]?.blockType).toBe('content')
      expect(tenantWithExtras.allowedBlocks).toContain('location')
    },
    TEST_TIMEOUT,
  )

  it(
    'should reject page with disallowed block for tenant with default only',
    async () => {
      await expect(
        payload.create({
          collection: 'pages',
          data: {
            title: 'Disallowed Block Page',
            slug: `disallowed-${Date.now()}`,
            tenant: tenantDefaultOnly.id,
            layout: [
              { blockType: 'content', blockName: 'Text section', content: { root: { type: 'root', children: [], direction: null, format: '', indent: 0, version: 1 } } },
              { blockType: 'location', blockName: 'Location', address: '123 Test St' }, // location not in tenantDefaultOnly allowedBlocks
            ],
            _status: 'published',
          },
          overrideAccess: true,
        }),
      ).rejects.toThrow(/not enabled for this tenant/)
    },
    TEST_TIMEOUT,
  )

  it(
    'should reject page with disallowed block for tenant with limited extras',
    async () => {
      // archive not in tenantWithExtras allowedBlocks (location, faqs only); archive has no required fields
      await expect(
        payload.create({
          collection: 'pages',
          data: {
            title: 'Wrong Extra Block Page',
            slug: `wrong-extra-${Date.now()}`,
            tenant: tenantWithExtras.id,
            layout: [
              { blockType: 'content', blockName: 'Text section', content: { root: { type: 'root', children: [], direction: null, format: '', indent: 0, version: 1 } } },
              { blockType: 'archive', blockName: 'Archive' },
            ],
            _status: 'published',
          },
          overrideAccess: true,
        }),
      ).rejects.toThrow(/not enabled for this tenant/)
    },
    TEST_TIMEOUT,
  )

  it(
    'should allow admin to create global page (no tenant) with any block including extras',
    async () => {
      // Global pages (no tenant) for admin should allow all blocks (filterOptions returns allPageBlockSlugs)
      const page = (await payload.create({
        collection: 'pages',
        data: {
          title: 'Global Page With Location',
          slug: `global-location-${Date.now()}`,
          tenant: null,
          layout: [
            { blockType: 'heroSchedule', blockName: 'Hero' },
            { blockType: 'location', blockName: 'Location', address: '123 Global St' },
          ],
          _status: 'published',
        },
        overrideAccess: true,
      })) as Page

      expect(page.tenant).toBeNull()
      expect(page.layout).toHaveLength(2)
      expect(page.layout?.[0]?.blockType).toBe('heroSchedule')
      expect(page.layout?.[1]?.blockType).toBe('location')
    },
    TEST_TIMEOUT,
  )
})
