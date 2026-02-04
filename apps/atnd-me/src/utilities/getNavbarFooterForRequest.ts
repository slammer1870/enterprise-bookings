import type { Payload } from 'payload'
import { getTenantSlug, getTenantContext } from './getTenantContext'

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
  }>
  styling?: {
    backgroundColor?: string
    textColor?: string
    showThemeSelector?: boolean
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

/**
 * Fetches navbar for the current request.
 * When tenant context exists: fetches from navbar collection for that tenant.
 * When no tenant (root domain): returns minimal default for marketing page.
 */
export async function getNavbarForRequest(
  payload: Payload,
  source?: TenantSlugSource | null
): Promise<NavbarData> {
  const tenant = await getTenantContext(payload, source)
  if (!tenant) {
    return DEFAULT_NAVBAR
  }

  const result = await payload.find({
    collection: 'navbar',
    where: { tenant: { equals: tenant.id } },
    limit: 1,
    depth: 1,
    overrideAccess: true,
  })

  const doc = result.docs[0]
  if (!doc) return DEFAULT_NAVBAR

  return {
    logo: doc.logo,
    logoLink: doc.logoLink ?? '/',
    navItems: doc.navItems ?? [],
    styling: doc.styling,
  } as NavbarData
}

/**
 * Fetches footer for the current request.
 * When tenant context exists: fetches from footer collection for that tenant.
 * When no tenant (root domain): returns minimal default for marketing page.
 */
export async function getFooterForRequest(
  payload: Payload,
  source?: TenantSlugSource | null
): Promise<FooterData> {
  const tenant = await getTenantContext(payload, source)
  if (!tenant) {
    return DEFAULT_FOOTER
  }

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
  if (!doc) return DEFAULT_FOOTER

  return {
    logo: doc.logo,
    logoLink: doc.logoLink ?? '/',
    copyrightText: doc.copyrightText,
    navItems: doc.navItems ?? [],
    styling: doc.styling,
  } as FooterData
}
