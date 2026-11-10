import dns from 'node:dns/promises'

async function loopbackSuffixResolves(suffix: 'nip.io' | 'sslip.io', timeoutMs: number): Promise<boolean> {
  try {
    const wildcardHost = `loopback-check-${Date.now() % 100000}.127.0.0.1.${suffix}`
    await Promise.race([
      dns.resolve4(`127.0.0.1.${suffix}`),
      dns.resolve4(wildcardHost),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`${suffix} DNS lookup timed out`)), timeoutMs)
      }),
    ])
    return true
  } catch {
    return false
  }
}

/** True when nip.io resolves (required for custom-domain e2e hosts like *.127.0.0.1.nip.io). */
export async function isNipIoDnsAvailable(timeoutMs = 3000): Promise<boolean> {
  return loopbackSuffixResolves('nip.io', timeoutMs)
}

/** True when sslip.io resolves. A second loopback apex, distinct from nip.io. */
export async function isSslipIoDnsAvailable(timeoutMs = 3000): Promise<boolean> {
  return loopbackSuffixResolves('sslip.io', timeoutMs)
}
