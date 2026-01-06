export type BetterAuthEmailConfig = {
  /**
   * When false, email sending functions are no-ops (except magic-link which can be enabled separately).
   */
  enabled: boolean
  /**
   * Optional overrides. If not provided, env vars are used.
   */
  fromAddress?: string
  fromName?: string
}

export function resolveBetterAuthEmailConfig(
  config?: Partial<BetterAuthEmailConfig>,
): BetterAuthEmailConfig {
  return {
    enabled: config?.enabled ?? false,
    fromAddress: config?.fromAddress || process.env.DEFAULT_FROM_ADDRESS || process.env.RESEND_FROM,
    fromName: config?.fromName || process.env.DEFAULT_FROM_NAME,
  }
}

export function formatFrom(fromName: string | undefined, fromAddress: string | undefined): string {
  const address = fromAddress || 'hello@brugrappling.com'
  const name = fromName || 'Brú Grappling'
  return name ? `${name} <${address}>` : address
}


