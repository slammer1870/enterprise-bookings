export function sanitizeFromAddress(input: unknown): string | undefined {
  const s = typeof input === 'string' ? input.trim() : ''
  if (!s) return undefined
  if (s.includes('\n') || s.includes('\r') || s.includes(' ')) return undefined
  if (!s.includes('@')) return undefined
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
    defaultFromAddress: sanitizeFromAddress(env.DEFAULT_FROM_ADDRESS) || '',
    defaultFromName: sanitizeFromName(env.DEFAULT_FROM_NAME) || 'ATND',
    apiKey: env.RESEND_API_KEY || '',
  }
}
