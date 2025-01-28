export type User = {
  id: string;
  roles: string[];
};

export type RolesPluginConfig = {
  /**
   * Enable or disable plugin
   * @default true
   */
  enabled?: boolean;

  /**
   * List of roles to use in the system
   * @default []
   */
  roles?: string[];

  /**
   * Role to assign to users if no roles are set
   * @default "customer"
   */
  defaultRole?: string;

  /**
   * Role to assign to users if no roles are set
   * @default "admin"
   */
  firstUserRole?: string;
};
