export function sanitizeFromAddress(input: unknown): string | undefined {
  const s = typeof input === 'string' ? input.trim() : ''
  if (!s) return undefined
  // Guard against malformed env injection and header-breaking characters.
  if (s.includes('\n') || s.includes('\r') || s.includes(' ')) return undefined
  // Common “env assignment” injection (e.g. "DEFAULT_FROM_ADDRESS=...") into env vars.
  if (s.includes('=')) return undefined
  if (!s.includes('@')) return undefined
  // Very small sanity check: must look like "local@domain.tld".
  // Resend rejects more strictly than Payload; better to fail fast.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return undefined
  if (s.length > 254) return undefined
  return s
}

export function sanitizeFromName(input: unknown): string | undefined {
  const s = typeof input === 'string' ? input.trim() : ''
  if (!s) return undefined
  // Guard against malformed env injection like "ATNDSTRIPE_CONNECT_CLIENT_ID=...".
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

export function resolvePayloadEmailConfig(env: NodeJS.ProcessEnv) {
  return {
    // Resend validates `from` strictly (must be a proper email or "Name <email>").
    // Avoid returning an empty string when env is missing/malformed.
    defaultFromAddress:
      sanitizeFromAddress(env.DEFAULT_FROM_ADDRESS) || sanitizeFromAddress('auth@atnd.me') || '',
    defaultFromName: sanitizeFromName(env.DEFAULT_FROM_NAME) || 'ATND',
    apiKey: env.RESEND_API_KEY || '',
  }
}
