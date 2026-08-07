import type { BasePayload } from 'payload'
import {
  mapResendStatusToEmailDomainStatus,
  type EmailDomainStatus,
} from './domains'

export type SyncTenantEmailDomainArgs = {
  payload: BasePayload
  /** Tenant document id */
  tenantId: string | number
  resendDomainId?: string | null
  /** Raw Resend status string (or 'verified' for domain.verified events) */
  resendStatus?: string | null
  /** When true, clear Resend linkage entirely (domain.deleted / domain cleared) */
  clear?: boolean
  /** Optional req for transaction continuity */
  req?: unknown
}

/**
 * Persist email-domain verification fields on a tenant from a Resend status.
 * Idempotent: skips the write when nothing changes.
 */
export async function syncTenantEmailDomainFromResend(
  args: SyncTenantEmailDomainArgs,
): Promise<{ emailDomainStatus: EmailDomainStatus; resendDomainId: string | null }> {
  const { payload, tenantId, clear } = args

  if (clear) {
    const existing = await payload.findByID({
      collection: 'tenants',
      id: tenantId,
      depth: 0,
      overrideAccess: true,
      select: {
        resendDomainId: true,
        emailDomainStatus: true,
        emailDomainVerifiedAt: true,
      } as Record<string, boolean>,
    })
    const prev = existing as {
      resendDomainId?: string | null
      emailDomainStatus?: string | null
      emailDomainVerifiedAt?: string | null
    }
    if (
      !prev?.resendDomainId &&
      (prev?.emailDomainStatus === 'not_configured' || !prev?.emailDomainStatus) &&
      !prev?.emailDomainVerifiedAt
    ) {
      return { emailDomainStatus: 'not_configured', resendDomainId: null }
    }

    await payload.update({
      collection: 'tenants',
      id: tenantId,
      data: {
        resendDomainId: null,
        emailDomainStatus: 'not_configured',
        emailDomainVerifiedAt: null,
      },
      overrideAccess: true,
      context: { skipApexHook: true, skipEmailDomainHook: true },
      ...(args.req ? { req: args.req as any } : {}),
    })
    return { emailDomainStatus: 'not_configured', resendDomainId: null }
  }

  const status = mapResendStatusToEmailDomainStatus(args.resendStatus)
  const resendDomainId =
    typeof args.resendDomainId === 'string' && args.resendDomainId.trim()
      ? args.resendDomainId.trim()
      : null

  const existing = await payload.findByID({
    collection: 'tenants',
    id: tenantId,
    depth: 0,
    overrideAccess: true,
    select: {
      resendDomainId: true,
      emailDomainStatus: true,
      emailDomainVerifiedAt: true,
    } as Record<string, boolean>,
  })
  const prev = existing as {
    resendDomainId?: string | null
    emailDomainStatus?: string | null
    emailDomainVerifiedAt?: string | null
  }

  const nextVerifiedAt =
    status === 'verified'
      ? prev?.emailDomainVerifiedAt || new Date().toISOString()
      : null

  const sameId = (prev?.resendDomainId || null) === resendDomainId
  const sameStatus = (prev?.emailDomainStatus || null) === status
  const sameVerified =
    status === 'verified'
      ? Boolean(prev?.emailDomainVerifiedAt)
      : !prev?.emailDomainVerifiedAt

  if (sameId && sameStatus && sameVerified) {
    return { emailDomainStatus: status, resendDomainId }
  }

  await payload.update({
    collection: 'tenants',
    id: tenantId,
    data: {
      resendDomainId,
      emailDomainStatus: status,
      emailDomainVerifiedAt: nextVerifiedAt,
    },
    overrideAccess: true,
    context: { skipApexHook: true, skipEmailDomainHook: true },
    ...(args.req ? { req: args.req as any } : {}),
  })

  return { emailDomainStatus: status, resendDomainId }
}

export async function findTenantIdByResendDomainId(
  payload: BasePayload,
  resendDomainId: string,
): Promise<string | number | null> {
  if (!resendDomainId) return null
  const result = await payload.find({
    collection: 'tenants',
    where: { resendDomainId: { equals: resendDomainId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    select: { id: true } as Record<string, boolean>,
  })
  const doc = result.docs[0] as { id?: string | number } | undefined
  return doc?.id ?? null
}
