import type { BasePayload } from 'payload'

import { getAbsoluteURL, getTenantSiteURL } from '@/utilities/getURL'

export type TenantEmailBranding = {
  name: string
  logoUrl: string | null
}

type TenantBrandingSource = {
  name?: unknown
  slug?: unknown
  domain?: unknown
  logo?: unknown
}

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function relationId(value: unknown): number | null {
  if (value == null) return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && /^\d+$/.test(value)) return parseInt(value, 10)
  if (typeof value === 'object' && value !== null && 'id' in value) {
    return relationId((value as { id?: unknown }).id)
  }
  return null
}

function logoUrlFromTenant(tenant: TenantBrandingSource): string | null {
  const logo = tenant.logo
  if (!logo || typeof logo !== 'object') return null
  const url = (logo as { url?: unknown }).url
  if (typeof url !== 'string' || !url.trim()) return null

  const trimmed = url.trim()
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed
  }

  const siteUrl = getTenantSiteURL({
    slug: typeof tenant.slug === 'string' ? tenant.slug : null,
    domain: typeof tenant.domain === 'string' ? tenant.domain : null,
  })
  return getAbsoluteURL(trimmed, siteUrl)
}

export function brandingFromTenantDoc(
  tenant: TenantBrandingSource | null | undefined,
  fallbackName = 'ATND ME',
): TenantEmailBranding {
  const name =
    tenant?.name != null && String(tenant.name).trim()
      ? String(tenant.name).trim()
      : fallbackName
  return {
    name,
    logoUrl: tenant ? logoUrlFromTenant(tenant) : null,
  }
}

export async function resolveTenantEmailBranding(
  payload: BasePayload,
  tenantIdOrDoc: number | string | TenantBrandingSource | null | undefined,
  fallbackName = 'ATND ME',
): Promise<TenantEmailBranding> {
  if (tenantIdOrDoc != null && typeof tenantIdOrDoc === 'object') {
    const id = relationId(tenantIdOrDoc)
    // Prefer a fresh depth-1 load when we only have an id-shaped relation or shallow logo.
    const hasPopulatedLogo =
      tenantIdOrDoc.logo != null &&
      typeof tenantIdOrDoc.logo === 'object' &&
      typeof (tenantIdOrDoc.logo as { url?: unknown }).url === 'string'
    if (hasPopulatedLogo && tenantIdOrDoc.name != null) {
      return brandingFromTenantDoc(tenantIdOrDoc, fallbackName)
    }
    if (id == null) return brandingFromTenantDoc(tenantIdOrDoc, fallbackName)
    return resolveTenantEmailBranding(payload, id, fallbackName)
  }

  const id = relationId(tenantIdOrDoc)
  if (id == null) {
    return { name: fallbackName, logoUrl: null }
  }

  try {
    const tenant = await payload.findByID({
      collection: 'tenants',
      id,
      depth: 1,
      overrideAccess: true,
      select: {
        name: true,
        slug: true,
        domain: true,
        logo: true,
      } as Record<string, boolean>,
    })
    return brandingFromTenantDoc(tenant as TenantBrandingSource | null, fallbackName)
  } catch {
    return { name: fallbackName, logoUrl: null }
  }
}

export function buildTenantEmailHeaderHtml({
  name,
  logoUrl,
}: {
  name: string
  logoUrl?: string | null
}): string {
  const safeName = escapeHtml(name)
  const safeLogoUrl =
    typeof logoUrl === 'string' && logoUrl.trim() ? escapeHtml(logoUrl.trim()) : null

  const logoBlock = safeLogoUrl
    ? `<img src="${safeLogoUrl}" alt="${safeName}" width="160" style="display:block;margin:0 auto 12px;max-height:48px;width:auto;height:auto;border:0;outline:none;text-decoration:none;" />`
    : ''

  return `<div style="padding:18px 0;border-bottom:1px solid #eaeaea;text-align:center;">
          ${logoBlock}
          <h1 style="font-size:28px;font-weight:700;color:#000;margin:0;">${safeName}</h1>
        </div>`
}

/**
 * Shared card shell for customer-facing emails that don't use React Email.
 * Body HTML is inserted as-is (callers own escaping of dynamic content).
 */
export function wrapCustomerEmailHtml({
  name,
  logoUrl,
  bodyHtml,
  title,
}: {
  name: string
  logoUrl?: string | null
  bodyHtml: string
  title?: string
}): string {
  const safeTitle = escapeHtml(title || name)
  const header = buildTenantEmailHeaderHtml({ name, logoUrl })

  return `<!doctype html>
<html>
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${safeTitle}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f6f9fc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen-Sans,Ubuntu,Cantarell,'Helvetica Neue',sans-serif;">
    <div style="padding:40px 0;">
      <div style="background-color:#ffffff;border:1px solid #eee;border-radius:5px;box-shadow:0 5px 10px rgba(20,50,70,0.2);margin:0 auto;max-width:600px;">
        ${header}
        <div style="padding:28px 24px;font-size:15px;line-height:1.55;color:#444;">
          ${bodyHtml}
        </div>
      </div>
    </div>
  </body>
</html>`
}
