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

export function resolveResendFromFallbackConfig(
  _env: NodeJS.ProcessEnv,
  primary: ReturnType<typeof resolvePayloadEmailConfig>,
) {
  // No extra env vars: hardcode the known alternate sender domain.
  // The goal is to avoid Resend 403 "domain is not verified" for tenant custom domains,
  // by retrying with a sender domain that is already verified in Resend.
  return {
    defaultFromAddress: sanitizeFromAddress('auth@atnd.ie') || primary.defaultFromAddress,
    defaultFromName: primary.defaultFromName,
    apiKey: primary.apiKey,
  }
}

export type EmailFromFallbackAdapters = {
  primary: { sendEmail: (message: any) => Promise<any> }
  fallback: { sendEmail: (message: any) => Promise<any> }
  // Injected for testing/diagnostics
  shouldFallback: (err: unknown) => boolean
}

/**
 * Generic retry wrapper for email adapters.
 *
 * Resend throws 403 `domain is not verified` when the `from` domain isn't verified.
 * Payload/resendAdapter will pass `message.from` through directly, so we retry with
 * `from` removed to force adapter defaults (which can be configured to `atnd.ie`).
 */
export function createFromFallbackEmailAdapter(args: {
  primaryAdapter: any
  fallbackAdapter: any
  shouldFallback?: (err: unknown) => boolean
}) {
  const { primaryAdapter, fallbackAdapter } = args

  const shouldFallback =
    args.shouldFallback ??
    ((err: unknown) => {
      const statusCode = typeof err === 'object' && err && 'statusCode' in err ? (err as any).statusCode : undefined
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err && 'message' in err
            ? String((err as any).message)
            : String(err)
      return statusCode === 403 && /domain is not verified/i.test(message)
    })

  return ({ payload }: { payload: any }) => {
    const primaryInitialized = primaryAdapter({ payload })
    const fallbackInitialized = fallbackAdapter({ payload })

    return {
      ...primaryInitialized,
      sendEmail: async (message: any) => {
        try {
          return await primaryInitialized.sendEmail(message)
        } catch (err) {
          if (!shouldFallback(err)) throw err

          // Remove `from` so the adapter uses its configured defaults.
          const retryMessage = { ...message, from: undefined }
          return await fallbackInitialized.sendEmail(retryMessage)
        }
      },
    }
  }
}
