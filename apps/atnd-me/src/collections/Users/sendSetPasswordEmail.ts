import { APIError, type PayloadRequest, type Where } from 'payload'

import { userTenantUpdate } from '@/access/userTenantAccess'
import { getRequestOrigin } from '@/utilities/getURL'

function inviteRedirectFromRequest(req: PayloadRequest): string | undefined {
  const headers = req.headers
  if (!headers || typeof headers.get !== 'function') return undefined
  const host = headers.get('x-forwarded-host') || headers.get('host')
  if (!host?.trim()) return undefined
  return getRequestOrigin(headers)
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
    await api.requestPasswordReset({
      body: {
        email,
        ...(redirectTo ? { redirectTo } : {}),
      },
      headers: req.headers,
    })
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
 * Email a Better Auth set-password link for an existing user.
 * The caller must be allowed to update that user. Read access is not enough:
 * staff can see roster accounts they must not reset.
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

  const access = await userTenantUpdate({ req, id })
  if (access === false) {
    throw new APIError('You cannot send a set-password email for this account.', 403)
  }

  const where: Where =
    access === true ? { id: { equals: id } } : { and: [{ id: { equals: id } }, access] }

  const found = await req.payload.find({
    collection: 'users',
    depth: 0,
    limit: 1,
    overrideAccess: false,
    pagination: false,
    req,
    where,
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
