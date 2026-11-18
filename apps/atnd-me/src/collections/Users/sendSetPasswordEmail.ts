import { APIError, type PayloadRequest } from 'payload'

import {
  isLocationManager,
  isStaffOnlyUser,
  userTenantRead,
  userTenantUpdate,
} from '@/access/userTenantAccess'
import { getRequestOrigin } from '@/utilities/getURL'

/**
 * Customer reset form (`app/(frontend)/auth/[path]` + better-auth-ui).
 * Better Auth appends `?token=` to this URL after the link is opened.
 * The site origin alone drops that token on the homepage.
 */
const SET_PASSWORD_PATH = '/auth/reset-password'

function inviteRedirectFromRequest(req: PayloadRequest): string | undefined {
  const headers = req.headers
  if (!headers || typeof headers.get !== 'function') return undefined
  const host = headers.get('x-forwarded-host') || headers.get('host')
  if (!host?.trim()) return undefined
  return `${getRequestOrigin(headers)}${SET_PASSWORD_PATH}`
}

function resetCallResult(value: unknown): { status?: unknown; message?: unknown } {
  if (!value || typeof value !== 'object') return {}
  const record = value as { status?: unknown; message?: unknown; response?: unknown }
  if (record.response && typeof record.response === 'object') {
    return record.response as { status?: unknown; message?: unknown }
  }
  return record
}

type RequestPasswordResetApi = {
  requestPasswordReset?: (input: {
    body: { email: string; redirectTo?: string }
    headers?: PayloadRequest['headers']
  }) => Promise<unknown>
}

/**
 * Ask Better Auth to email its own reset link (`sendResetPassword`).
 * Do not use Payload `forgotPassword` — that link updates the Payload hash
 * only, and members sign in through Better Auth.
 */
export async function sendSetPasswordResetEmail(args: {
  email: string
  req: PayloadRequest
  userId: string
}): Promise<void> {
  const { email, req, userId } = args
  const api = (req.payload as { betterAuth?: { api?: RequestPasswordResetApi } }).betterAuth?.api
  if (!api?.requestPasswordReset) {
    req.payload.logger?.error?.(
      `[users] Set-password email skipped for user ${userId}: auth API unavailable`,
    )
    throw new APIError(
      'Could not email a link for this person to set their password.',
      400,
    )
  }

  const redirectTo = inviteRedirectFromRequest(req)
  try {
    const result = await api.requestPasswordReset({
      body: {
        email,
        ...(redirectTo ? { redirectTo } : {}),
      },
      headers: req.headers,
    })
    // Better Auth returns status true and a message, and does not email,
    // when it cannot find the account.
    const sent = resetCallResult(result)
    const skipped =
      typeof sent.message === 'string' && sent.message.trim().length > 0
    if (sent.status !== true || skipped) {
      throw new Error('Reset password email was not sent')
    }
  } catch (err) {
    req.payload.logger?.error?.(
      `[users] Set-password email failed for user ${userId}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    )
    throw new APIError(
      'Could not email a link for this person to set their password.',
      400,
    )
  }
}

function userIdFromParam(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string' && /^\d+$/.test(raw)) return parseInt(raw, 10)
  return null
}

/**
 * Who may email a set-password link.
 * Tenant admins and location-managers use their update scope. Staff cannot
 * edit the roster, but they may email accounts inside the same tenant read
 * scope. Accounts outside that tenant are refused.
 */
async function accessForSetPasswordEmail(req: PayloadRequest, id: number) {
  const user = req.user
  if (user && isStaffOnlyUser(user) && !isLocationManager(user)) {
    return userTenantRead({ req, id })
  }
  return userTenantUpdate({ req, id })
}

/**
 * Email a Better Auth set-password link for an existing user.
 * The lookup is tenant-scoped: the caller's membership where is applied with
 * the target id, so a role in one organization cannot email another.
 */
export async function sendSetPasswordEmailForUser(
  req: PayloadRequest,
  rawId: unknown,
): Promise<void> {
  if (!req.user) {
    throw new APIError('Unauthorized', 401)
  }

  const id = userIdFromParam(rawId)
  if (id == null) {
    throw new APIError('User id is required', 400)
  }

  const access = await accessForSetPasswordEmail(req, id)
  if (access === false) {
    throw new APIError('You cannot send a set-password email for this account.', 403)
  }

  // The access result above is only a hard deny. Do not copy it into `where`:
  // location-managers and staff cannot read `registrationTenant` or
  // `tenants.tenant`, and Payload rejects those paths on the caller query.
  // Collection read (`overrideAccess: false`) may still return that constraint.
  const found = await req.payload.find({
    collection: 'users',
    depth: 0,
    limit: 1,
    overrideAccess: false,
    pagination: false,
    req,
    where: { id: { equals: id } },
  })

  const doc = found.docs[0]
  if (!doc) {
    throw new APIError(
      access === true
        ? 'User not found'
        : 'You cannot send a set-password email for this account.',
      access === true ? 404 : 403,
    )
  }

  const email = typeof doc.email === 'string' ? doc.email.trim() : ''
  if (!email) {
    throw new APIError('This account has no email address.', 400)
  }

  await sendSetPasswordResetEmail({
    email,
    req,
    userId: doc.id != null ? String(doc.id) : String(id),
  })
}
