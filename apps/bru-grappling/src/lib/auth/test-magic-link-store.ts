type MagicLinkRecord = {
  email: string
  token: string
  url: string
  createdAt: number
}

const isTestMagicLinkEnabled =
  process.env.NODE_ENV === 'test' || process.env.ENABLE_TEST_MAGIC_LINKS === 'true'

// Persist across Next.js dev hot-reloads by stashing on globalThis
const globalStoreKey = '__TEST_MAGIC_LINK_STORE__'
const globalStore = (globalThis as typeof globalThis & { [globalStoreKey]?: Map<string, MagicLinkRecord> })[
  globalStoreKey
]
const magicLinkStore: Map<string, MagicLinkRecord> =
  globalStore || ((globalThis as any)[globalStoreKey] = new Map<string, MagicLinkRecord>())

/**
 * Save the most recent magic link for an email.
 * No-ops unless the test store is enabled.
 */
export function saveTestMagicLink({
  email,
  token,
  url,
}: {
  email: string
  token: string
  url: string
}): void {
  if (!isTestMagicLinkEnabled) return
  const normalizedEmail = email.toLowerCase()
  magicLinkStore.set(normalizedEmail, {
    email: normalizedEmail,
    token,
    url,
    createdAt: Date.now(),
  })
}

/**
 * Get the latest stored magic link for an email.
 * Returns null if disabled or none stored.
 */
export function getLatestTestMagicLink(email: string): MagicLinkRecord | null {
  if (!isTestMagicLinkEnabled) return null
  const normalizedEmail = email.toLowerCase()
  return magicLinkStore.get(normalizedEmail) ?? null
}

/**
 * Clear stored magic links for a single email or all.
 * No-ops when the store is disabled.
 */
export function clearTestMagicLinks(email?: string): void {
  if (!isTestMagicLinkEnabled) return
  if (email) {
    magicLinkStore.delete(email.toLowerCase())
  } else {
    magicLinkStore.clear()
  }
}

export function isTestMagicLinkStoreEnabled(): boolean {
  return isTestMagicLinkEnabled
}

