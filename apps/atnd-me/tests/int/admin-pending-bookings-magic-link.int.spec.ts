/**
 * Admin dashboard flow: tenant admin creates multiple pending bookings for a user,
 * sends a completion magic link, and the recipient can see all pending bookings on manage.
 *
 * Preserved for staff-created pending bookings + magic link flow (holds are for customer checkout).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { APIError, getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import { createTRPCContext } from '@repo/trpc'
import { appRouter } from '@repo/trpc'
import type { User, Timeslot, EventType } from '@repo/shared-types'
import { ATND_ME_BOOKINGS_COLLECTION_SLUGS } from '@/constants/bookings-collection-slugs'
import { defaultTimeslotFields } from './timeslot-test-data'
import { sendLateBookingMagicLinkEndpoint } from '@/endpoints/admin/bookings/send-late-booking-magic-link'

const sendBookingCompletionMagicLink = vi.hoisted(() => vi.fn(async () => {}))

vi.mock('@/lib/auth/options', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/options')>()
  return {
    ...actual,
    sendBookingCompletionMagicLink: (...args: unknown[]) => sendBookingCompletionMagicLink(...args),
  }
})

const HOOK_TIMEOUT = 300000

describe('Admin pending bookings + completion magic link', () => {
  let payload: Payload
  let tenant: { id: number; slug: string }
  let tenantAdmin: User
  let recipient: User
  let lesson: Timeslot

  const createCaller = async (u: User) => {
    const ctx = await createTRPCContext({
      headers: new Headers({ 'tenant-slug': tenant.slug }),
      payload,
      user: u,
      bookingsCollectionSlugs: ATND_ME_BOOKINGS_COLLECTION_SLUGS,
    } as Parameters<typeof createTRPCContext>[0])
    return appRouter.createCaller(ctx)
  }

  beforeAll(async () => {
    process.env.NEXT_PUBLIC_SERVER_URL = 'http://localhost:3000'
    payload = await getPayload({ config: await config })

    tenant = (await payload.create({
      collection: 'tenants',
      data: {
        name: 'Admin Pending Booking Tenant',
        slug: `admin-pending-${Date.now()}`,
        // No Stripe Connect — admin must still be able to add pending bookings.
      },
      overrideAccess: true,
    })) as { id: number; slug: string }

    tenantAdmin = (await payload.create({
      collection: 'users',
      data: {
        name: 'Tenant Admin Pending',
        email: `ta-pending-${Date.now()}@test.com`,
        password: 'test',
        role: ['admin'],
        emailVerified: true,
        tenants: [{ tenant: tenant.id }],
      },
      overrideAccess: true,
    })) as User

    recipient = (await payload.create({
      collection: 'users',
      data: {
        name: 'Booking Recipient',
        email: `recipient-pending-${Date.now()}@test.com`,
        password: 'test',
        role: ['user'],
        emailVerified: true,
      },
      overrideAccess: true,
    })) as User

    const eventType = (await payload.create({
      collection: 'event-types',
      data: {
        name: 'Admin Pending Class',
        places: 10,
        description: 'Paid class — admin bypasses Connect for pending rows',
        tenant: tenant.id,
      },
      overrideAccess: true,
    })) as EventType

    const slotFields = defaultTimeslotFields(4)
    lesson = (await payload.create({
      collection: 'timeslots',
      data: {
        eventType: eventType.id,
        ...slotFields,
        tenant: tenant.id,
      },
      overrideAccess: true,
    })) as Timeslot
  }, HOOK_TIMEOUT)

  afterAll(async () => {
    if (payload?.db) await payload.db.destroy()
  })

  it('tenant admin can create multiple pending bookings for the same user and timeslot', async () => {
    const pendingIds: number[] = []

    for (let i = 0; i < 3; i += 1) {
      const booking = await payload.create({
        collection: 'bookings',
        data: {
          user: recipient.id,
          timeslot: lesson.id,
          status: 'pending',
          tenant: tenant.id,
        },
        user: tenantAdmin,
        overrideAccess: false,
      })
      pendingIds.push(booking.id as number)
    }

    expect(pendingIds).toHaveLength(3)
    expect(new Set(pendingIds).size).toBe(3)

    const stored = await payload.find({
      collection: 'bookings',
      where: {
        and: [
          { timeslot: { equals: lesson.id } },
          { user: { equals: recipient.id } },
          { status: { equals: 'pending' } },
        ],
      },
      overrideAccess: true,
    })

    expect(stored.totalDocs).toBe(3)
  })

  it('sendLateBookingMagicLink sends manage-page callback for a pending booking', async () => {
    sendBookingCompletionMagicLink.mockClear()

    const booking = await payload.create({
      collection: 'bookings',
      data: {
        user: recipient.id,
        timeslot: lesson.id,
        status: 'pending',
        tenant: tenant.id,
      },
      user: tenantAdmin,
      overrideAccess: false,
    })

    const reqHeaders = new Headers()
    reqHeaders.set('host', `${tenant.slug}.localhost:3000`)
    reqHeaders.set('x-forwarded-proto', 'http')

    const res = await sendLateBookingMagicLinkEndpoint.handler({
      json: async () => ({ bookingId: booking.id }),
      user: tenantAdmin,
      payload,
      headers: reqHeaders,
    } as never)

    expect(res.status).toBe(200)
    expect(sendBookingCompletionMagicLink).toHaveBeenCalledTimes(1)

    const [args] = sendBookingCompletionMagicLink.mock.calls[0] as [
      { email: string; callbackURL: string; expiresInSeconds: number },
    ]
    expect(args.email).toBe(recipient.email!.toLowerCase())
    expect(args.callbackURL).toContain(`/bookings/${lesson.id}/manage`)
    expect(args.callbackURL).toContain(`${tenant.slug}.localhost`)
    expect(args.expiresInSeconds).toBe(36 * 60 * 60)
  })

  it('sendLateBookingMagicLink rejects non-pending bookings', async () => {
    const booking = await payload.create({
      collection: 'bookings',
      data: {
        user: recipient.id,
        timeslot: lesson.id,
        status: 'confirmed',
        tenant: tenant.id,
      },
      overrideAccess: true,
    })

    await expect(
      sendLateBookingMagicLinkEndpoint.handler({
        json: async () => ({ bookingId: booking.id }),
        user: tenantAdmin,
        payload,
        headers: new Headers(),
      } as never),
    ).rejects.toBeInstanceOf(APIError)
  })

  it('recipient sees all admin-created pending bookings via getUserBookingsForTimeslot', async () => {
    await payload.delete({
      collection: 'bookings',
      where: {
        and: [
          { timeslot: { equals: lesson.id } },
          { user: { equals: recipient.id } },
        ],
      },
      overrideAccess: true,
    })

    for (let i = 0; i < 2; i += 1) {
      await payload.create({
        collection: 'bookings',
        data: {
          user: recipient.id,
          timeslot: lesson.id,
          status: 'pending',
          tenant: tenant.id,
        },
        user: tenantAdmin,
        overrideAccess: false,
      })
    }

    const caller = await createCaller(recipient)
    const bookings = await caller.bookings.getUserBookingsForTimeslot({
      timeslotId: lesson.id as number,
    })

    expect(bookings).toHaveLength(2)
    expect(bookings.every((b) => b.status === 'pending')).toBe(true)
  })
})
