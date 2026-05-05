import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const ORIGINAL_ENV = { ...process.env }

describe('Admin magic-link callbackURL origin', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env = { ...ORIGINAL_ENV }
    process.env.NODE_ENV = 'test'
    process.env.NEXT_PUBLIC_SERVER_URL = 'http://localhost:3000'
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
    vi.restoreAllMocks()
  })

  it('uses tenant subdomain origin when tenant has no custom domain', async () => {
    vi.doMock('@/access/userTenantAccess', () => ({
      isAdmin: () => true,
      isTenantAdmin: () => false,
      isStaff: () => false,
    }))

    vi.doMock('@/access/tenant-scoped', () => ({
      getUserTenantIds: () => null,
    }))

    const signInMagicLink = vi.fn(async () => {})

    const payloadFindByID = vi.fn(async ({ collection, id }: any) => {
      if (collection === 'bookings') {
        return {
          status: 'pending',
          timeslot: 200,
          user: { email: 'person@example.com' },
          tenant: 100,
        }
      }
      if (collection === 'timeslots') {
        return { tenant: 100 }
      }
      if (collection === 'tenants') {
        return { slug: 'acme', domain: null }
      }
      return null
    })

    vi.doMock('@/lib/payload', () => ({}))

    const { sendLateBookingMagicLinkEndpoint } = await import(
      '../../src/endpoints/admin/bookings/send-late-booking-magic-link'
    )

    const reqHeaders = new Headers()
    reqHeaders.set('host', 'admin.platform.local:3000')
    reqHeaders.set('x-forwarded-proto', 'http')

    await sendLateBookingMagicLinkEndpoint.handler({
      json: async () => ({ bookingId: 1 }),
      user: { id: 'actor' },
      payload: {
        findByID: payloadFindByID,
        betterAuth: { api: { signInMagicLink } },
      },
      headers: reqHeaders,
    } as any)

    expect(signInMagicLink).toHaveBeenCalledTimes(1)
    const [args] = signInMagicLink.mock.calls[0] as any[]
    const callbackURL = args.body.callbackURL as string
    expect(callbackURL).toContain('http://acme.localhost:3000/bookings/200/manage')
  })

  it('uses tenant custom domain with request protocol when tenant has a custom domain', async () => {
    vi.doMock('@/access/userTenantAccess', () => ({
      isAdmin: () => true,
      isTenantAdmin: () => false,
      isStaff: () => false,
    }))

    vi.doMock('@/access/tenant-scoped', () => ({
      getUserTenantIds: () => null,
    }))

    const signInMagicLink = vi.fn(async () => {})

    const payloadFindByID = vi.fn(async ({ collection }: any) => {
      if (collection === 'bookings') {
        return {
          status: 'pending',
          timeslot: 200,
          user: { email: 'person@example.com' },
          tenant: 100,
        }
      }
      if (collection === 'timeslots') {
        return { tenant: 100 }
      }
      if (collection === 'tenants') {
        return { slug: null, domain: 'studio.example.com' }
      }
      return null
    })

    const { sendLateBookingMagicLinkEndpoint } = await import(
      '../../src/endpoints/admin/bookings/send-late-booking-magic-link'
    )

    const reqHeaders = new Headers()
    reqHeaders.set('host', 'admin.platform.local')
    reqHeaders.set('x-forwarded-proto', 'https')

    await sendLateBookingMagicLinkEndpoint.handler({
      json: async () => ({ bookingId: 1 }),
      user: { id: 'actor' },
      payload: {
        findByID: payloadFindByID,
        betterAuth: { api: { signInMagicLink } },
      },
      headers: reqHeaders,
    } as any)

    expect(signInMagicLink).toHaveBeenCalledTimes(1)
    const [args] = signInMagicLink.mock.calls[0] as any[]
    const callbackURL = args.body.callbackURL as string
    expect(callbackURL).toContain(
      'https://studio.example.com/bookings/200/manage',
    )
  })
})

