export interface User {
  id: number;
  name: string;
  email: string;
  /**
   * Better Auth / Payload Auth canonical RBAC field (select, hasMany).
   * Prefer this over legacy `roles`.
   */
  role?: string | string[];
  /** @deprecated Use `role`; kept for older docs/tests during migration. */
  roles?: string[];
  stripeCustomerId?: string;
  image?: {
    url: string;
  };
  parentUser?: User;
  createdAt?: string;
  updatedAt?: string;
}
