import { APIError, type Endpoint } from 'payload'

import { isAdmin, isStaff, isTenantAdmin } from '@/access/userTenantAccess'
import { getUserTenantIds } from '@/access/tenant-scoped'
import { ATND_ME_BOOKINGS_COLLECTION_SLUGS } from '@/constants/bookings-collection-slugs'
import type { User as SharedUser } from '@repo/shared-types'
import { getAbsoluteURL, getRequestOrigin, getTenantSiteURL } from '@/utilities/getURL'

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

function getServerUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SERVER_URL || process.env.SERVER_URL
}

function buildTenantScopedCallbackURL(args: {
  callbackPath: string
  tenant:
    | {
        slug?: string | null
        domain?: string | null
      }
    | null
  headers: Headers
  serverUrlFallback?: string | undefined
}): string {
  const base =
    args.tenant != null && (args.tenant.domain != null || args.tenant.slug != null)
      ? getTenantSiteURL(args.tenant, args.headers)
      : getRequestOrigin(args.headers) || args.serverUrlFallback

  if (!base) {
    // Better-auth will accept relative callbackURLs, but we require tenant scoping.
    // If we can't determine an origin at all, fail closed rather than sending the global URL.
    throw new APIError('Missing request origin for magic link callbackURL', 500)
  }

  return getAbsoluteURL(args.callbackPath, base)
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

    const bookingTenantId = coerceNumericId((booking as any)?.tenant)
    const timeslotTenantId = coerceNumericId((timeslot as any)?.tenant)
    const tenantIdForCallback = bookingTenantId ?? timeslotTenantId ?? null

    // Tenant isolation for org admins/staff.
    // Some schemas may not expose `tenant` directly on the timeslot doc; booking usually has it,
    // so we fall back to `booking.tenant` for the access check.
    const tenantIds = getUserTenantIds(actor as unknown as SharedUser | null)
    if (tenantIds !== null) {
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

    // Magic link sending is implemented in tRPC (`auth.signInMagicLink`) which calls
    // `ctx.betterAuth.api.signInMagicLink`. We can invoke the same Better Auth API directly here.
    // This avoids brittle REST-path assumptions (magic-link is not necessarily mounted at /api/users/*).
    const payloadWithBetterAuth = req.payload as any
    const signInMagicLink = payloadWithBetterAuth?.betterAuth?.api?.signInMagicLink as
      | undefined
      | ((
          args: {
            body: { email: string; callbackURL?: string }
            headers: Headers
          },
        ) => Promise<unknown>)

    if (!signInMagicLink) {
      throw new APIError('Better Auth is not configured for magic link sending', 500)
    }

    // Always scope callbackURL to the tenant's custom domain (if configured) or subdomain.
    // This ensures Better Auth redirects the user back to the correct tenant host.
    const tenantForCallback =
      tenantIdForCallback != null
        ? ((await req.payload.findByID({
            collection: 'tenants',
            id: tenantIdForCallback as any,
            depth: 0,
            select: { slug: true, domain: true } as any,
          })) as unknown as { slug?: string | null; domain?: string | null } | null)
        : null

    const callbackURL = buildTenantScopedCallbackURL({
      callbackPath,
      tenant: tenantForCallback,
      headers: req.headers as unknown as Headers,
      serverUrlFallback: serverUrl,
    })

    // Better Auth appears to build the magic-link verify URL using the request host.
    // Since this endpoint is called from the admin panel (often on the platform host),
    // override headers so the verify link is generated on the tenant host.
    let headersForMagicLink: Headers = req.headers as unknown as Headers
    try {
      const tenantOrigin = new URL(callbackURL).origin
      const tenantUrl = new URL(tenantOrigin)
      const tenantHost = tenantUrl.host
      const tenantProtocol = tenantUrl.protocol.replace(':', '')

      headersForMagicLink = new Headers(req.headers as unknown as Headers)
      headersForMagicLink.set('host', tenantHost)
      headersForMagicLink.set('x-forwarded-host', tenantHost)
      headersForMagicLink.set('origin', tenantOrigin)
      headersForMagicLink.set('x-forwarded-proto', tenantProtocol)
    } catch {
      // If callbackURL isn't parseable as an absolute URL, fall back to original headers.
    }

    await signInMagicLink({
      body: { email: userEmail.toLowerCase(), callbackURL },
      headers: headersForMagicLink,
    })

    return Response.json({ ok: true })
  },
}

