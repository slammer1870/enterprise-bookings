import type { BasePayload } from 'payload'
import { createOrGetDomain, deleteDomain } from './domains'
import { isPlatformEmailApex } from './emailSendingDomain'
import { syncTenantEmailDomainFromResend } from './syncTenantEmailDomain'

/**
 * Provision or tear down a Resend sending domain when the email sending domain changes.
 * That domain is the apex of the canonical host. The platform apex is not provisioned.
 * Best-effort: failures are logged and do not throw (the public host still works).
 */
export async function provisionTenantEmailDomain(args: {
  payload: BasePayload
  tenantId: string | number
  newDomain: string | null
  previousResendDomainId?: string | null
  req?: unknown
}): Promise<void> {
  const { payload, tenantId, newDomain, previousResendDomainId, req } = args

  try {
    const emailDomain = newDomain?.trim().toLowerCase() || null
    // The platform apex is shared. Do not create or delete a Resend domain for it.
    if (!emailDomain || isPlatformEmailApex(emailDomain)) {
      if (previousResendDomainId) {
        await deleteDomain(previousResendDomainId).catch((err: unknown) => {
          console.error(
            `[resend/provision] Failed to delete Resend domain "${previousResendDomainId}":`,
            err,
          )
        })
      }
      await syncTenantEmailDomainFromResend({
        payload,
        tenantId,
        clear: true,
        req,
      })
      return
    }

    // Domain changed: remove previous Resend domain if different
    const domain = await createOrGetDomain(emailDomain)
    if (!domain?.id) {
      console.error(`[resend/provision] Failed to create/get Resend domain for "${emailDomain}"`)
      await syncTenantEmailDomainFromResend({
        payload,
        tenantId,
        resendDomainId: null,
        resendStatus: 'failed',
        req,
      })
      return
    }

    if (previousResendDomainId && previousResendDomainId !== domain.id) {
      await deleteDomain(previousResendDomainId).catch((err: unknown) => {
        console.error(
          `[resend/provision] Failed to delete previous Resend domain "${previousResendDomainId}":`,
          err,
        )
      })
    }

    await syncTenantEmailDomainFromResend({
      payload,
      tenantId,
      resendDomainId: domain.id,
      resendStatus: domain.status,
      req,
    })
  } catch (err) {
    console.error(`[resend/provision] Unexpected error for tenant ${tenantId}:`, err)
  }
}
