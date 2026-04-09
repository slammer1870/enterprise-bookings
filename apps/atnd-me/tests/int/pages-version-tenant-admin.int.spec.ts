import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import type { User } from '@repo/shared-types'

const HOOK_TIMEOUT = 300000
const TEST_TIMEOUT = 60000

function getTenantId(tenant: number | { id: number } | null | undefined): number | null {
  if (tenant === null || tenant === undefined) return null
  if (typeof tenant === 'number') return tenant
  if (typeof tenant === 'object' && 'id' in tenant) return tenant.id
  return null
}

describe('Pages versions and tenant-from-context (tenant-admin)', () => {
  let payload: Payload
  let testTenantId: number
  let tenantAdminUser: User

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    const tenant = await payload.create({
      collection: 'tenants',
      data: {
        name: 'Pages Version Test Tenant',
        slug: `pages-version-${Date.now()}`,
        allowedBlocks: ['location'], // allow custom block for "select custom block" test
      },
      overrideAccess: true,
    })
    testTenantId = tenant.id as number

    tenantAdminUser = (await payload.create({
      collection: 'users',
      data: {
        name: 'Tenant Admin Pages',
        email: `tenant-admin-pages-${Date.now()}@test.com`,
        password: 'test',
        roles: ['admin'],
        emailVerified: true,
        tenants: [{ tenant: testTenantId }],
      },
      draft: false,
      overrideAccess: true,
    } as Parameters<typeof payload.create>[0])) as User

    await new Promise((r) => setTimeout(r, 500))
  }, HOOK_TIMEOUT)

  afterAll(async () => {
    if (payload) {
      try {
        const pages = await payload.find({
          collection: 'pages',
          where: { tenant: { equals: testTenantId } },
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
          id: testTenantId,
          overrideAccess: true,
        })
        await payload.delete({
          collection: 'users',
          id: tenantAdminUser.id,
          overrideAccess: true,
        })
      } catch {
        // ignore
      }
      if (payload.db?.destroy) await payload.db.destroy()
    }
  })

  it(
    'tenant-admin can save page multiple times without version unique constraint error',
    async () => {
      const slug = `version-test-${Date.now()}`
      const req = {
        user: tenantAdminUser,
        context: { tenant: testTenantId },
      } as any

      const created = await payload.create({
        collection: 'pages',
        data: {
          title: 'Version Test Page',
          slug,
          tenant: testTenantId,
          layout: [{ blockType: 'heroSchedule', blockName: 'Hero & Schedule' }],
          _status: 'published',
        },
        overrideAccess: true,
      })

      await payload.update({
        collection: 'pages',
        id: created.id,
        data: { title: 'Version Test Page (first update)' },
        req,
        overrideAccess: false,
      })

      await payload.update({
        collection: 'pages',
        id: created.id,
        data: { title: 'Version Test Page (second update)' },
        req,
        overrideAccess: false,
      })

      const after = await payload.findByID({
        collection: 'pages',
        id: created.id,
        req,
        overrideAccess: false,
      })
      expect(after?.title).toBe('Version Test Page (second update)')
      expect(getTenantId(after?.tenant)).toBe(testTenantId)
    },
    TEST_TIMEOUT,
  )

  it(
    'beforeValidate sets tenant from context when data.tenant is missing (tenant-admin create)',
    async () => {
      const slug = `context-tenant-${Date.now()}`
      const req = {
        user: tenantAdminUser,
        context: { tenant: testTenantId },
      } as any

      const created = await payload.create({
        collection: 'pages',
        data: {
          title: 'Context Tenant Page',
          slug,
          layout: [{ blockType: 'heroSchedule', blockName: 'Hero & Schedule' }],
          _status: 'published',
        },
        req,
        overrideAccess: false,
      })

      expect(created).toBeDefined()
      expect(getTenantId(created?.tenant)).toBe(testTenantId)
    },
    TEST_TIMEOUT,
  )

  it(
    'tenant-admin can add a custom block and save (simulates selecting custom block)',
    async () => {
      const slug = `custom-block-${Date.now()}`
      const req = {
        user: tenantAdminUser,
        context: { tenant: testTenantId },
      } as any

      const created = await payload.create({
        collection: 'pages',
        data: {
          title: 'Custom Block Test',
          slug,
          tenant: testTenantId,
          layout: [{ blockType: 'heroSchedule', blockName: 'Hero & Schedule' }],
          _status: 'published',
        },
        overrideAccess: true,
      })

      await payload.update({
        collection: 'pages',
        id: created.id,
        data: {
          layout: [
            { blockType: 'heroSchedule', blockName: 'Hero & Schedule' },
            { blockType: 'location', blockName: 'Location', address: '123 Test St' },
          ],
        },
        req,
        overrideAccess: false,
      })

      const after = await payload.findByID({
        collection: 'pages',
        id: created.id,
        req,
        overrideAccess: false,
      })
      expect(after?.layout).toHaveLength(2)
      expect(after?.layout?.[1]?.blockType).toBe('location')
      expect(getTenantId(after?.tenant)).toBe(testTenantId)
    },
    TEST_TIMEOUT,
  )
})
