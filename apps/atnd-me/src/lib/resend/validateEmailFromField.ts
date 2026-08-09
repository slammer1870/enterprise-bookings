import type { TextFieldSingleValidation } from 'payload'
import { loadTenantEmailFromGate } from '@/lib/resend/loadTenantEmailFromGate'
import {
  emailFromContainsTemplateVars,
  getEmailFromTenantDomainValidationError,
} from '@/lib/resend/resolveTenantEmailFrom'
import { getTenantIdForCreateRequest } from '@/utilities/getTenantContext'

function relationId(value: unknown): number | string | null {
  if (value == null) return null
  if (typeof value === 'object' && value !== null && 'id' in value) {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'number' || typeof id === 'string') return id
  }
  if (typeof value === 'number' || typeof value === 'string') return value
  return null
}

export const EMAIL_FROM_ADMIN_DESCRIPTION =
  'Must use your verified studio email domain (e.g. hello@your-domain.com). Leave blank to use the platform default. Template placeholders like {{field}} are allowed and checked when the email sends.'

/**
 * Payload field validate for emailFrom on forms / post-booking / course emails.
 * Empty and {{template}} values pass; literal From must match the tenant's verified domain.
 */
export const validateEmailFromField: TextFieldSingleValidation = async (value, { req, data }) => {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return true
  if (emailFromContainsTemplateVars(raw)) return true

  let tenantId = relationId(data?.tenant)
  if (tenantId == null) {
    tenantId = await getTenantIdForCreateRequest(req.payload, {
      headers: req.headers,
      context: req.context,
    })
  }

  if (tenantId == null) {
    return 'Select a studio before setting a custom Email From address.'
  }

  const gate = await loadTenantEmailFromGate(req.payload, tenantId)
  const error = getEmailFromTenantDomainValidationError({
    emailFrom: raw,
    tenantDomain: gate?.domain,
    emailDomainVerified: gate?.verified,
  })
  return error ?? true
}
