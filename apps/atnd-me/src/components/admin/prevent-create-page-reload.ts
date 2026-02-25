/**
 * Helpers to avoid reloads/clearing on tenant-required collection create pages (e.g. lessons, instructors).
 * Used to skip router.refresh() and prevent Enter-from-submit on those routes.
 *
 * Note: On mobile, the form can also clear when *any* input is typed (not just Enter). That is often
 * caused by Payload's server function running on field change (e.g. to fetch relationship filter
 * options) and returning an RSC payload with form state; when the client applies that payload it
 * can overwrite in-progress input. That behaviour is inside Payload/Next.js; if it persists after
 * the guards here, consider reporting to Payload or checking for a config to reduce server round-trips
 * on create (e.g. disabling live preview or form-state sync for create routes).
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

/**
 * Collections where create is allowed with no tenant for admin only (e.g. base/root pages,
 * root navbar/footer). Tenant-admins must have a tenant selected to create; if they hit
 * the create route with no tenant, we redirect them to the list to avoid the multi-tenant
 * plugin redirecting to document ID 1 (which they may not have access to).
 */
export const COLLECTIONS_CREATE_REQUIRE_TENANT_FOR_TENANT_ADMIN = new Set([
  'pages',
  'navbar',
  'footer',
])

export function isTenantRequiredCreatePath(pathname: string | null): boolean {
  if (typeof pathname !== 'string') return false
  const match = pathname.match(/\/collections\/([^/]+)\/create$/)
  const slug = match?.[1]
  return slug != null && COLLECTIONS_REQUIRE_TENANT_ON_CREATE.has(slug)
}

export function isCreateRequireTenantForTenantAdminPath(pathname: string | null): boolean {
  if (typeof pathname !== 'string') return false
  const match = pathname.match(/\/collections\/([^/]+)\/create$/)
  const slug = match?.[1]
  return slug != null && COLLECTIONS_CREATE_REQUIRE_TENANT_FOR_TENANT_ADMIN.has(slug)
}
