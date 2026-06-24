/** Per-tenant role entry. Determines what a user can do within a specific tenant. */
export interface UserTenantRole {
  tenant: number | { id: number; [key: string]: unknown };
  roles?: string[];
  id?: string | number;
}

export interface User {
  id: number;
  name: string;
  email: string;
  /**
   * Better Auth / Payload Auth canonical RBAC field (select, hasMany).
   * For non-super-admin users this field is gradually superseded by `tenantRoles`.
   * The only globally meaningful value going forward is `super-admin`.
   */
  role?: string | string[];
  /** @deprecated Use `role`; kept for older docs/tests during migration. */
  roles?: string[];
  /**
   * Per-tenant role assignments. Authoritative when populated; falls back to the
   * global `role` field when empty (migration window). A user can have a different
   * role at each tenant — e.g. admin at Tenant A, staff at Tenant B, user at Tenant C.
   */
  tenantRoles?: UserTenantRole[];
  stripeCustomerId?: string;
  image?: {
    url: string;
  };
  parentUser?: User;
  createdAt?: string;
  updatedAt?: string;
}
