import type { Payload } from 'payload'
import { getTenantContext, getTenantWithBranding } from './getTenantContext'

export type TenantSlugSource = import('./getTenantContext').TenantSlugSource

/**
 * Minimal navbar shape for layout rendering.
 * Compatible with both Navbar collection and Header global.
 */
export type NavbarData = {
  logo?: { url?: string; alt?: string } | number | null
  logoLink: string
  navItems: Array<{
    link?: { type?: string; url?: string; label?: string; reference?: unknown }
    renderAsButton?: boolean
    buttonVariant?: string
    icon?: 'none' | 'instagram' | 'facebook' | 'x' | null
  }>
  styling?: {
    backgroundColor?: string
    textColor?: string
    sticky?: boolean
    padding?: string
  }
}

/**
 * Minimal footer shape for layout rendering.
 * Compatible with both Footer collection and Footer global.
 */
export type FooterData = {
  logo?: { url?: string; alt?: string } | number | null
  logoLink: string
  copyrightText?: string
  navItems: Array<{
    link?: { type?: string; url?: string; label?: string; reference?: unknown }
    icon?: 'none' | 'instagram' | 'facebook' | 'x' | null
  }>
  styling?: {
    backgroundColor?: string
    textColor?: string
    showThemeSelector?: boolean
    padding?: string
  }
}

const DEFAULT_NAVBAR: NavbarData = {
  logoLink: '/',
  navItems: [],
}

const DEFAULT_FOOTER: FooterData = {
  logoLink: '/',
  copyrightText: '',
  navItems: [],
}

/** Resolves logo from doc or tenant; uses tenant as white-label fallback. */
function resolveLogo(
  docLogo: unknown,
  tenantBranding: { logo?: unknown; name?: string } | null
): NavbarData['logo'] {
  const hasDocLogo = docLogo && typeof docLogo === 'object' && 'url' in (docLogo as object)
  if (hasDocLogo) return docLogo as NavbarData['logo']
  const tenantLogo = tenantBranding?.logo
  const hasTenantLogo = tenantLogo && typeof tenantLogo === 'object' && 'url' in (tenantLogo as object)
  if (hasTenantLogo) return tenantLogo as NavbarData['logo']
  return null
}

/**
 * Fetches navbar for the current request.
 * When tenant context exists: fetches from navbar collection for that tenant.
 * When no tenant (root domain): fetches the root navbar (document with tenant = null) if one exists.
 * White labeling: uses tenant.logo and tenant.name as fallback when navbar has no logo.
 * Falls back to minimal default when no tenant and no root navbar exists.
 */
export async function getNavbarForRequest(
  payload: Payload,
  source?: TenantSlugSource | null
): Promise<NavbarData> {
  const tenant = await getTenantContext(payload, source)

  if (!tenant) {
    const rootResult = await payload.find({
      collection: 'navbar',
      where: { tenant: { equals: null } },
      limit: 1,
      depth: 1,
      overrideAccess: true,
    })
    const rootDoc = rootResult.docs[0]
    if (!rootDoc) return DEFAULT_NAVBAR
    const logo = resolveLogo(rootDoc?.logo, null)
    const logoWithAlt =
      logo && typeof logo === 'object' && logo !== null
        ? { ...logo, alt: (logo.alt as string) || 'Logo' }
        : logo
    return {
      logo: logoWithAlt,
      logoLink: (rootDoc as { logoLink?: string }).logoLink ?? '/',
      navItems: (rootDoc as { navItems?: NavbarData['navItems'] }).navItems ?? [],
      styling: (rootDoc as { styling?: NavbarData['styling'] }).styling,
    }
  }

  const tenantBranding = await getTenantWithBranding(payload, source)

  const result = await payload.find({
    collection: 'navbar',
    where: { tenant: { equals: tenant.id } },
    limit: 1,
    depth: 1,
    overrideAccess: true,
  })

  const doc = result.docs[0]
  const logo = resolveLogo(doc?.logo, tenantBranding)

  if (!doc) {
    const logoWithAlt =
      logo && typeof logo === 'object' && logo !== null
        ? { ...logo, alt: (logo.alt as string) || tenantBranding?.name || 'Logo' }
        : logo
    return {
      logo: logoWithAlt,
      logoLink: '/',
      navItems: [],
      styling: undefined,
    }
  }

  const logoWithAlt =
    logo && typeof logo === 'object' && logo !== null
      ? { ...logo, alt: (logo.alt as string) || tenantBranding?.name || 'Logo' }
      : logo

  return {
    logo: logoWithAlt,
    logoLink: (doc as { logoLink?: string }).logoLink ?? '/',
    navItems: (doc as { navItems?: NavbarData['navItems'] }).navItems ?? [],
    styling: (doc as { styling?: NavbarData['styling'] }).styling,
  }
}

/**
 * Fetches footer for the current request.
 * When tenant context exists: fetches from footer collection for that tenant.
 * When no tenant (root domain): fetches the root footer (document with tenant = null) if one exists.
 * White labeling: uses tenant.logo and tenant.name/description as fallback when footer has no logo/copyright.
 * Falls back to minimal default when no tenant and no root footer exists.
 */
export async function getFooterForRequest(
  payload: Payload,
  source?: TenantSlugSource | null
): Promise<FooterData> {
  const tenant = await getTenantContext(payload, source)

  if (!tenant) {
    const rootResult = await payload.find({
      collection: 'footer',
      where: { tenant: { equals: null } },
      limit: 1,
      depth: 1,
      overrideAccess: true,
    })
    const rootDoc = rootResult.docs[0]
    if (!rootDoc) return DEFAULT_FOOTER
    const logo = resolveLogo(rootDoc?.logo, null)
    const logoWithAlt =
      logo && typeof logo === 'object' && logo !== null
        ? { ...logo, alt: (logo.alt as string) || 'Logo' }
        : logo
    const rootTyped = rootDoc as {
      logoLink?: string
      copyrightText?: string
      navItems?: FooterData['navItems']
      styling?: FooterData['styling']
    }
    return {
      logo: logoWithAlt,
      logoLink: rootTyped.logoLink ?? '/',
      copyrightText: rootTyped.copyrightText,
      navItems: rootTyped.navItems ?? [],
      styling: rootTyped.styling,
    }
  }

  const tenantBranding = await getTenantWithBranding(payload, source)

  // Use req.context.tenant instead of where.tenant to avoid known bug
  // (footer find with where.tenant generates invalid SQL: "where  = $1")
  const req = {
    payload,
    context: { tenant: tenant.id },
  } as Parameters<Payload['find']>[0]['req']
  const result = await payload.find({
    collection: 'footer',
    limit: 1,
    depth: 1,
    overrideAccess: true,
    req,
  })

  const doc = result.docs[0]
  const logo = resolveLogo(doc?.logo, tenantBranding)

  const logoWithAlt =
    logo && typeof logo === 'object' && logo !== null
      ? { ...logo, alt: (logo.alt as string) || tenantBranding?.name || 'Logo' }
      : logo

  if (!doc) {
    return {
      logo: logoWithAlt,
      logoLink: '/',
      copyrightText: tenantBranding?.name
        ? `© ${new Date().getFullYear()} ${tenantBranding.name}`
        : undefined,
      navItems: [],
      styling: undefined,
    }
  }

  const docTyped = doc as {
    logoLink?: string
    copyrightText?: string
    navItems?: FooterData['navItems']
    styling?: FooterData['styling']
  }

  return {
    logo: logoWithAlt,
    logoLink: docTyped.logoLink ?? '/',
    copyrightText:
      docTyped.copyrightText ??
      (tenantBranding?.name ? `© ${new Date().getFullYear()} ${tenantBranding.name}` : undefined),
    navItems: docTyped.navItems ?? [],
    styling: docTyped.styling,
  }
}
