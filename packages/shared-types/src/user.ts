export interface User {
  id: number;
  name: string;
  email: string;
  /**
   * Better Auth / Payload Auth canonical RBAC field (select, hasMany).
   * For non-super-admin users this is a denormalized "highest role" summary derived from
   * `tenants[n].roles` by the Users beforeChange hook. The only globally meaningful value
   * going forward is `super-admin` — per-tenant precision lives in `tenants[n].roles`.
   */
  role?: string | string[];
  /** @deprecated Use `role`; kept for older docs/tests during migration. */
  roles?: string[];
  /**
   * Consolidated tenant memberships with per-tenant role assignments.
   * Each entry captures both "this user belongs to this tenant" and
   * "this user has these roles at this tenant" in one structure.
   *
   * Replaces the now-removed `tenantRoles` array.
   */
  tenants?: Array<{
    tenant: number | { id: number; [key: string]: unknown };
    roles?: string[];
    id?: string | number;
  }>;
  stripeCustomerId?: string;
  image?: {
    url: string;
  };
  parentUser?: User;
  createdAt?: string;
  updatedAt?: string;
}
