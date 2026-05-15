import type { Payload } from 'payload'

import { getPublicBranchSlugFromRequest, type CookiesLike } from '@/utilities/tenantRequest'

export type LocationBranchContext = {
  id: number
  slug: string
  name: string
  tenantId: number
  active: boolean
}

export type LocationContextSource = {
  /** Next.js `pathname` (or request URL pathname), e.g. `/locations/dublin`. */
  pathname?: string | null
  cookies?: CookiesLike
}

/**
 * Extract branch slug from the first `/locations/:slug` segment.
 * Allows further path segments, e.g. `/locations/dublin/schedule` → `dublin`.
 */
export function parseBranchSlugFromPathname(pathname: string | null | undefined): string | null {
  if (pathname == null || typeof pathname !== 'string') return null
  const pathOnly = pathname.split('?')[0]?.split('#')[0] ?? pathname
  const match = pathOnly.match(/^\/locations\/([^/]+)(?:\/|$)/)
  if (!match?.[1]) return null
  try {
    const decoded = decodeURIComponent(match[1]).trim()
    return decoded || null
  } catch {
    return null
  }
}

/**
 * Resolve the current **branch** (`locations` row) for a tenant from URL path or public cookie.
 *
 * **Precedence:** pathname `/locations/{slug}` wins when present; otherwise `branch-slug` cookie
 * ({@link PUBLIC_BRANCH_SLUG_COOKIE}). If the path carries a slug segment, that slug alone is
 * queried (no cookie fallback when the slug does not resolve).
 *
 * Only **active** locations are returned (public / schedule context).
 */
export async function getLocationContext(
  payload: Payload,
  args: {
    tenantId: number
    source?: LocationContextSource | null
  },
): Promise<LocationBranchContext | null> {
  const tenantId = args.tenantId
  if (tenantId == null || !Number.isFinite(tenantId)) return null

  const pathname = args.source?.pathname
  const slug =
    parseBranchSlugFromPathname(pathname) ??
    getPublicBranchSlugFromRequest({ cookies: args.source?.cookies })

  if (!slug) return null

  const result = await payload.find({
    collection: 'locations',
    where: {
      and: [
        { tenant: { equals: tenantId } },
        { slug: { equals: slug } },
        { active: { equals: true } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    select: {
      id: true,
      slug: true,
      name: true,
      tenant: true,
      active: true,
    } as any,
  })

  const doc = result.docs[0] as
    | {
        id: number
        slug: string
        name?: string
        tenant?: number | { id: number }
        active?: boolean
      }
    | undefined

  if (!doc) return null

  const rowTenant =
    typeof doc.tenant === 'object' && doc.tenant !== null && 'id' in doc.tenant
      ? doc.tenant.id
      : doc.tenant
  if (typeof rowTenant !== 'number' || rowTenant !== tenantId) {
    return null
  }

  return {
    id: doc.id,
    slug: doc.slug,
    name: typeof doc.name === 'string' ? doc.name : '',
    tenantId: rowTenant,
    active: doc.active !== false,
  }
}
