import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mocks that must be set up before importing the modules under test ---
const mockDraftMode = vi.fn()
const mockCookies = vi.fn()

vi.mock('next/headers', () => ({
  draftMode: () => mockDraftMode(),
  cookies: () => mockCookies(),
}))

const mockGetPayload = vi.fn()
vi.mock('@/lib/payload', () => ({
  getPayload: () => mockGetPayload(),
}))

const mockGetTenantContext = vi.fn()
const mockGetTenantWithBranding = vi.fn()
vi.mock('@/utilities/getTenantContext', () => ({
  getTenantContext: (...args: any[]) => mockGetTenantContext(...args),
  getTenantWithBranding: (...args: any[]) => mockGetTenantWithBranding(...args),
}))

describe('public root docs can resolve referenced media', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDraftMode.mockResolvedValue({ isEnabled: false })
    mockCookies.mockResolvedValue({ get: vi.fn() })
    mockGetTenantWithBranding.mockResolvedValue(null)
  })

  it('queryPageBySlug uses overrideAccess on root domain (no tenant)', async () => {
    mockGetTenantContext.mockResolvedValue(null)

    const payload = {
      find: vi.fn().mockResolvedValue({ docs: [{ id: 1, layout: [] }] }),
    }
    mockGetPayload.mockResolvedValue(payload)

    const { queryPageBySlug } = await import('../../src/app/(frontend)/[slug]/queryPageBySlug')

    await queryPageBySlug({ slug: 'root' })

    expect(payload.find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'pages',
        overrideAccess: true,
        where: expect.objectContaining({
          slug: { equals: 'root' },
          tenant: { equals: null },
        }),
      }),
    )
  })

  it('queryPageBySlug keeps access on tenant domains (non-draft)', async () => {
    mockGetTenantContext.mockResolvedValue({ id: 2 })

    const payload = {
      find: vi.fn().mockResolvedValue({ docs: [{ id: 10, layout: [] }] }),
    }
    mockGetPayload.mockResolvedValue(payload)

    const { queryPageBySlug } = await import('../../src/app/(frontend)/[slug]/queryPageBySlug')

    await queryPageBySlug({ slug: 'home' })

    expect(payload.find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'pages',
        overrideAccess: false,
        where: expect.objectContaining({
          slug: { equals: 'home' },
          tenant: { equals: 2 },
        }),
      }),
    )
  })

  it('root navbar/footer fetch uses overrideAccess and sufficient depth', async () => {
    mockGetTenantContext.mockResolvedValue(null)

    const payload = {
      find: vi.fn().mockResolvedValue({
        docs: [
          {
            logo: { url: '/media/logo.png', alt: 'Logo' },
            logoLink: '/',
            navItems: [],
            copyrightText: '©',
          },
        ],
      }),
    } as any

    const { getNavbarForRequest, getFooterForRequest } = await import(
      '../../src/utilities/getNavbarFooterForRequest'
    )

    await getNavbarForRequest(payload)
    await getFooterForRequest(payload)

    // Called for navbar root doc
    expect(payload.find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'navbar',
        where: { tenant: { equals: null } },
        overrideAccess: true,
        depth: 2,
      }),
    )

    // Called for footer root doc
    expect(payload.find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'footer',
        where: { tenant: { equals: null } },
        overrideAccess: true,
        depth: 2,
      }),
    )
  })
})

