import dns from 'node:dns/promises'

/** True when nip.io resolves (required for custom-domain e2e hosts like *.127.0.0.1.nip.io). */
export async function isNipIoDnsAvailable(timeoutMs = 3000): Promise<boolean> {
  try {
    await Promise.race([
      dns.resolve4('127.0.0.1.nip.io'),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('nip.io DNS lookup timed out')), timeoutMs)
      }),
    ])
    return true
  } catch {
    return false
  }
}
