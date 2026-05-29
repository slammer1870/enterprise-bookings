import dns from 'node:dns/promises'

/** True when nip.io resolves (required for custom-domain e2e hosts like *.127.0.0.1.nip.io). */
export async function isNipIoDnsAvailable(timeoutMs = 3000): Promise<boolean> {
  try {
    // Verify both the base name and a representative wildcard-style subdomain.
    // `e2e-foo.127.0.0.1.nip.io` should resolve to 127.0.0.1.
    const wildcardHost = `nipio-check-${Date.now() % 100000}.127.0.0.1.nip.io`
    await Promise.race([
      dns.resolve4('127.0.0.1.nip.io'),
      dns.resolve4(wildcardHost),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('nip.io DNS lookup timed out')), timeoutMs)
      }),
    ])
    return true
  } catch {
    return false
  }
}
