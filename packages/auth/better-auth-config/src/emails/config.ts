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

function sanitizeFromAddress(input: unknown): string | undefined {
  const s = typeof input === 'string' ? input.trim() : ''
  if (!s) return undefined
  if (s.includes('\n') || s.includes('\r') || s.includes(' ')) return undefined
  if (!s.includes('@')) return undefined
  if (s.length > 254) return undefined
  return s
}

function sanitizeFromName(input: unknown): string | undefined {
  const s = typeof input === 'string' ? input.trim() : ''
  if (!s) return undefined
  // Protect against broken env injection (e.g. "ATNDSTRIPE_CONNECT_CLIENT_ID=...").
  if (s.includes('\n') || s.includes('\r') || s.includes('=')) return undefined

  const ascii = s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '')
    .trim()

  if (!ascii) return undefined
  if (ascii.length > 120) return undefined
  return ascii
}

export function resolveBetterAuthEmailConfig(
  config?: Partial<BetterAuthEmailConfig>,
): BetterAuthEmailConfig {
  return {
    enabled: config?.enabled ?? false,
    fromAddress: sanitizeFromAddress(
      config?.fromAddress || process.env.DEFAULT_FROM_ADDRESS || process.env.RESEND_FROM,
    ),
    fromName: sanitizeFromName(config?.fromName || process.env.DEFAULT_FROM_NAME),
  }
}

export function formatFrom(fromName: string | undefined, fromAddress: string | undefined): string {
  const address = sanitizeFromAddress(fromAddress) || 'hello@example.com'
  const name = sanitizeFromName(fromName) || 'Example App'
  return name ? `${name} <${address}>` : address
}


