import type { BeforeEmail } from '@payloadcms/plugin-form-builder/types'
import {
  resolveTenantEmailBranding,
  wrapCustomerEmailHtml,
} from '@/lib/email/tenant-email-branding'
import { loadTenantEmailFromGate } from '@/lib/resend/loadTenantEmailFromGate'
import { sanitizeEmailFromForTenantDomain } from '@/lib/resend/resolveTenantEmailFrom'

function relationId(value: unknown): number | null {
  if (value == null) return null
  if (typeof value === 'object' && value !== null && 'id' in value) {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'number') return id
    if (typeof id === 'string' && /^\d+$/.test(id)) return parseInt(id, 10)
  }
  if (typeof value === 'number') return value
  if (typeof value === 'string' && /^\d+$/.test(value)) return parseInt(value, 10)
  return null
}

/**
 * Form-builder beforeEmail: drop custom From unless the form's tenant has
 * verified that From host as their email-sending domain.
 */
export const beforeFormEmail: BeforeEmail = async (emails, { data, req }) => {
  const formId = relationId(data?.form)
  let tenantId = relationId(data?.tenant)

  if (tenantId == null && formId != null) {
    const form = await req.payload
      .findByID({
        collection: 'forms',
        id: formId,
        depth: 0,
        overrideAccess: true,
        select: { tenant: true } as Record<string, boolean>,
      })
      .catch(() => null)
    tenantId = relationId((form as { tenant?: unknown } | null)?.tenant)
  }

  const [gate, branding] = await Promise.all([
    loadTenantEmailFromGate(req.payload, tenantId),
    resolveTenantEmailBranding(req.payload, tenantId),
  ])

  return emails.map((email) => {
    const from =
      sanitizeEmailFromForTenantDomain({
        emailFrom: email.from,
        tenantDomain: gate?.domain,
        emailDomainVerified: gate?.verified,
      }) ?? ''
    const rawHtml = typeof email.html === 'string' ? email.html.trim() : ''
    const html = rawHtml
      ? wrapCustomerEmailHtml({
          name: branding.name,
          logoUrl: branding.logoUrl,
          bodyHtml: rawHtml,
          title: typeof email.subject === 'string' ? email.subject : branding.name,
        })
      : email.html
    return { ...email, from, html }
  })
}
