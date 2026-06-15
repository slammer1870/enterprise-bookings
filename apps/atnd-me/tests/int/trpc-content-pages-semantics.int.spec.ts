import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import config from '@/payload.config'
import { getPayload, type Payload } from 'payload'
import { createTRPCContext, appRouter, ATND_ME_BOOKINGS_COLLECTION_SLUGS } from '@repo/trpc'
import type { Tenant, Page } from '@repo/shared-types'

const TEST_TIMEOUT = 60_000
const HOOK_TIMEOUT = 120_000

describe('tRPC content: pages root vs tenant semantics', () => {
  let payload: Payload
  let tenant: Tenant

  const slug = `content-pages-${Date.now()}`
  const rootTitle = 'Root semantics page'
  const tenantTitle = 'Tenant semantics page'

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    tenant = (await payload.create({
      collection: 'tenants',
      data: {
        name: 'tRPC Content Pages Tenant',
        slug: `content-pages-tenant-${Date.now()}`,
      },
      overrideAccess: true,
    })) as Tenant

    // Allow tenant onboarding hooks to settle (e.g. home page generation).
    await new Promise((r) => setTimeout(r, 2_000))

    // Create a root/global page (tenant === null).
    await payload.create({
      collection: 'pages',
      data: {
        slug,
        title: rootTitle,
        tenant: null,
        _status: 'published',
        layout: [{ blockType: 'heroSchedule', title: rootTitle }],
      },
      overrideAccess: true,
    })

    // Create tenant-scoped page with the same slug.
    await payload.create({
      collection: 'pages',
      data: {
        slug,
        title: tenantTitle,
        tenant: tenant.id,
        _status: 'published',
        layout: [{ blockType: 'heroScheduleSanctuary', blockName: 'Homepage — hero with schedule', title: tenantTitle }],
      },
      overrideAccess: true,
    })
  }, HOOK_TIMEOUT)

  afterAll(async () => {
    try {
      await payload.delete({
        collection: 'pages',
        where: { slug: { equals: slug } },
        overrideAccess: true,
      })
      await payload.delete({
        collection: 'tenants',
        where: { id: { equals: tenant.id } },
        overrideAccess: true,
      })
    } finally {
      await payload.db?.destroy?.()
    }
  })

  it(
    'returns root page when tenantId is null',
    async () => {
      const ctx = await createTRPCContext({
        headers: new Headers(),
        payload,
        bookingsCollectionSlugs: ATND_ME_BOOKINGS_COLLECTION_SLUGS,
      })

      const caller = appRouter.createCaller(ctx)
      const doc = await caller.content.pages.bySlug({
        slug,
        draft: false,
        tenantId: null,
      })

      expect(doc).not.toBeNull()
      expect((doc as Page).title).toBe(rootTitle)
    },
    TEST_TIMEOUT,
  )

  it(
    'returns tenant page when tenantId is set',
    async () => {
      const ctx = await createTRPCContext({
        headers: new Headers(),
        payload,
        bookingsCollectionSlugs: ATND_ME_BOOKINGS_COLLECTION_SLUGS,
      })

      const caller = appRouter.createCaller(ctx)
      const doc = await caller.content.pages.bySlug({
        slug,
        draft: false,
        tenantId: tenant.id,
      })

      expect(doc).not.toBeNull()
      expect((doc as Page).title).toBe(tenantTitle)
    },
    TEST_TIMEOUT,
  )
})

