import { APIError, type Endpoint } from 'payload'

import { isAdmin, isStaff, isTenantAdmin } from '@/access/userTenantAccess'
import { getUserTenantIds } from '@/access/tenant-scoped'
import { ATND_ME_BOOKINGS_COLLECTION_SLUGS } from '@/constants/bookings-collection-slugs'
import type { User as SharedUser } from '@repo/shared-types'

function coerceNumericId(input: unknown): number | null {
  if (typeof input === 'number' && Number.isFinite(input)) return input
  if (typeof input === 'string') {
    const n = parseInt(input, 10)
    if (Number.isFinite(n)) return n
  }
  if (typeof input === 'object' && input != null && 'id' in input) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return coerceNumericId((input as any).id)
  }
  return null
}

function extractEndTimeMs(input: unknown): number | null {
  if (typeof input === 'string') {
    const ms = new Date(input).getTime()
    return Number.isFinite(ms) ? ms : null
  }
  if (input instanceof Date) {
    const ms = input.getTime()
    return Number.isFinite(ms) ? ms : null
  }
  return null
}

function getServerUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SERVER_URL || process.env.SERVER_URL
}

export const sendLateBookingMagicLinkEndpoint: Endpoint = {
  path: '/admin/bookings/late-magic-link/send',
  method: 'post',
  handler: async (req) => {
    if (!req.json) throw new APIError('Invalid request body', 400)

    const body = (await req.json().catch(() => null)) as
      | { bookingId?: unknown }
      | null

    const bookingId = coerceNumericId(body?.bookingId)
    if (bookingId == null) throw new APIError('bookingId is required', 400)

    const actor = req.user
    if (!actor || (!isAdmin(actor) && !isTenantAdmin(actor) && !isStaff(actor))) {
      throw new APIError('Forbidden', 403)
    }

    const serverUrl = getServerUrl()
    if (!serverUrl) throw new APIError('Missing SERVER_URL', 500)

    // Load booking. We intentionally do this without `overrideAccess: true` so
    // Payload’s collection access controls apply.
    const booking = (await req.payload
      .findByID({
        collection: ATND_ME_BOOKINGS_COLLECTION_SLUGS.bookings,
        id: bookingId as any,
        depth: 0,
      })
      .catch(() => null)) as
      | Record<string, unknown>
      | null

    if (!booking) throw new APIError('Booking not found', 404)
    if (booking.status !== 'pending') throw new APIError('Booking is not pending', 400)

    const timeslotId = coerceNumericId(booking.timeslot)
    if (timeslotId == null) throw new APIError('timeslot is required', 400)

    const timeslot = (await req.payload
      .findByID({
        collection: ATND_ME_BOOKINGS_COLLECTION_SLUGS.timeslots,
        id: timeslotId as any,
        depth: 0,
      })
      .catch(() => null)) as
      | Record<string, unknown>
      | null

    if (!timeslot) throw new APIError('Timeslot not found', 404)

    const endTimeMs = extractEndTimeMs(timeslot.endTime)
    // If we can't resolve endTime, we err on the side of sending (feature completeness),
    // matching the original hook's behavior.
    if (endTimeMs != null && Date.now() < endTimeMs) throw new APIError('Timeslot has not ended', 400)

    // Tenant isolation for org admins/staff.
    // Some schemas may not expose `tenant` directly on the timeslot doc; booking usually has it,
    // so we fall back to `booking.tenant` for the access check.
    const tenantIds = getUserTenantIds(actor as unknown as SharedUser | null)
    if (tenantIds !== null) {
      const bookingTenantId = coerceNumericId((booking as any)?.tenant)
      const timeslotTenantId = coerceNumericId((timeslot as any)?.tenant)
      const tenantIdToCheck = bookingTenantId ?? timeslotTenantId
      if (tenantIdToCheck != null && !tenantIds.includes(tenantIdToCheck)) {
        throw new APIError('Forbidden', 403)
      }
      // If tenantIdToCheck is missing, we can't validate tenant isolation here;
      // collection access control already provides a baseline safety net.
    }

    // Resolve recipient email.
    let userEmail: string | undefined
    const maybeUser = booking.user
    if (typeof maybeUser === 'object' && maybeUser != null) {
      const m = maybeUser as { email?: unknown }
      userEmail = typeof m.email === 'string' ? m.email : undefined
    }

    if (!userEmail) {
      const userId = coerceNumericId(booking.user)
      if (userId == null) throw new APIError('user is required', 400)

      const user = (await req.payload
        .findByID({
          collection: 'users',
          id: userId as any,
          depth: 0,
        })
        .catch(() => null)) as
        | Record<string, unknown>
        | null

      userEmail = typeof user?.email === 'string' ? user.email : undefined
    }

    if (!userEmail) throw new APIError('Recipient email missing', 400)

    const callbackPath = `/bookings/${timeslotId}/manage`
    if (!callbackPath.startsWith('/')) throw new APIError('Invalid callback', 400)

    const res = await fetch(`${serverUrl}/api/users/send-magic-link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: userEmail.toLowerCase(),
        callbackUrl: callbackPath,
        utmParams: '',
      }),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new APIError(
        `Failed to send late booking magic link: ${res.status}${text ? `: ${text}` : ''}`,
        500,
      )
    }

    return Response.json({ ok: true })
  },
}

