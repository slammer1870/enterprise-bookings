export interface PluginTypes {
  /**
   * Enable or disable plugin
   * @default false
   */
  enabled?: boolean;

  /**
   * URL to the server. This is used to redirect users after login.
   * Must not have trailing slash.
   * Must start with http:// or https://
   */
  serverURL?: string;

  /**
   * Slug of the collection where user information will be stored
   * @default "users"
   */
  authCollection?: string;

  /**
   * Name of the app
   */
  appName: string;
}
