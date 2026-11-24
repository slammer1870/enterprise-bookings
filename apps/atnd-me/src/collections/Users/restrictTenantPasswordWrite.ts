import crypto from 'crypto'
import type { PayloadRequest } from 'payload'

import { isAdmin } from '@/access/userTenantAccess'

/**
 * Set on tenant-admin HTTP creates. The plaintext stand-in lives only until
 * beforeChange restores it (field access deletes `data.password` during
 * beforeValidate). The admin sends the set-password email from the user form.
 */
export const ATND_FORCE_SET_OWN_PASSWORD = 'atndForceSetOwnPassword'
export const ATND_FORCED_PASSWORD = 'atndForcedPassword'

function writableData(args: unknown): Record<string, unknown> | null {
  if (!args || typeof args !== 'object' || !('data' in args)) return null
  const data = (args as { data?: unknown }).data
  if (!data || typeof data !== 'object') return null
  return data as Record<string, unknown>
}

function isPublicHttpApi(req: PayloadRequest): boolean {
  return req.payloadAPI === 'REST' || req.payloadAPI === 'GraphQL'
}

function contextOf(req: PayloadRequest): Record<string, unknown> {
  if (!req.context || typeof req.context !== 'object') {
    const created: Record<string, unknown> = {}
    req.context = created as typeof req.context
    return created
  }
  return req.context as Record<string, unknown>
}

function stripConfirmPassword(data: Record<string, unknown>): void {
  delete data['confirm-password']
  delete data.passwordConfirm
  delete data.confirmPassword
}

/**
 * Authenticated non-super-admins on the public HTTP API must not choose a
 * password. Local API (seeds, tests, claim flow) and anonymous signup keep
 * the client-supplied password. Super-admins may still set one.
 *
 * Must run in beforeOperation. `updateDocument` copies `data.password` before
 * collection beforeChange, and payload-auth's sync-account then copies
 * `salt:hash` onto the Better Auth credential (the password every tenant logs
 * in with).
 */
export function shouldRestrictPasswordWrite(req: PayloadRequest): boolean {
  if (!isPublicHttpApi(req)) return false
  if (!req.user) return false
  if (isAdmin(req.user)) return false
  return true
}

/**
 * Field access for the virtual `password` field.
 * Platform super-admin is global `role` only. Every other signed-in caller is
 * denied — including Local API. Admin field permissions run through
 * `createLocalReq` (`payloadAPI: 'local'`); allowing Local here made
 * `password.create` true for tenant admins and left create-form password
 * inputs enabled. Seeds / claim / anonymous signup pass no user (or use
 * `overrideAccess: true`), so they still set a password.
 */
export function canSetUserPassword(
  req: { user?: unknown; payloadAPI?: string } | null | undefined,
): boolean {
  if (!req?.user) return true
  if (isAdmin(req.user)) return true
  return false
}

export function restrictTenantPasswordWrite<T>(args: {
  args: T
  operation: string
  req: PayloadRequest
}): T {
  const { args: operationArgs, operation, req } = args
  if (!shouldRestrictPasswordWrite(req)) return operationArgs
  if (operation !== 'create' && operation !== 'update') return operationArgs

  const data = writableData(operationArgs)
  if (!data) return operationArgs

  stripConfirmPassword(data)

  if (operation === 'update') {
    delete data.password
    return operationArgs
  }

  const ctx = contextOf(req)
  if (ctx[ATND_FORCE_SET_OWN_PASSWORD] === true && typeof data.password === 'string') {
    return operationArgs
  }

  const forced = crypto.randomBytes(32).toString('hex')
  data.password = forced
  ctx[ATND_FORCE_SET_OWN_PASSWORD] = true
  ctx[ATND_FORCED_PASSWORD] = forced
  return operationArgs
}

/**
 * Field access false deletes `data.password` in beforeValidate, which would
 * leave the auth create with no password. Put the random stand-in back after
 * that strip and drop it from request context.
 */
export function restoreForcedPasswordOnCreate(args: {
  data?: Record<string, unknown> | null
  operation: string
  req: PayloadRequest
}): Record<string, unknown> | null | undefined {
  const { data, operation, req } = args
  if (operation !== 'create' || !data) return data
  const ctx = req.context as Record<string, unknown> | undefined
  const forced = ctx?.[ATND_FORCED_PASSWORD]
  if (!ctx || typeof forced !== 'string' || forced.length === 0) return data
  data.password = forced
  delete ctx[ATND_FORCED_PASSWORD]
  return data
}
