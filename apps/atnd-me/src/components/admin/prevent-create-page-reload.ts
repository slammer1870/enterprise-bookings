/**
 * Helpers to avoid reloads/clearing on tenant-required collection create pages (e.g. lessons, instructors).
 * Used to skip router.refresh() and prevent Enter-from-submit on those routes.
 */

export const COLLECTIONS_REQUIRE_TENANT_ON_CREATE = new Set([
  'lessons',
  'instructors',
  'class-options',
  'bookings',
  'class-pass-types',
  'class-passes',
  'transactions',
  'drop-ins',
  'plans',
  'discount-codes',
  'subscriptions',
  'forms',
  'form-submissions',
  'scheduler',
])

export function isTenantRequiredCreatePath(pathname: string | null): boolean {
  if (typeof pathname !== 'string') return false
  const match = pathname.match(/\/collections\/([^/]+)\/create$/)
  const slug = match?.[1]
  return slug != null && COLLECTIONS_REQUIRE_TENANT_ON_CREATE.has(slug)
}
