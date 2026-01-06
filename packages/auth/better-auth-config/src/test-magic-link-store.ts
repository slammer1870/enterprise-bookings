export type MagicLinkRecord = {
  email: string
  token: string
  url: string
  createdAt: number
}

const isTestMagicLinkEnabled =
  process.env.NODE_ENV === 'test' || process.env.ENABLE_TEST_MAGIC_LINKS === 'true'

// Persist across Next.js dev hot-reloads by stashing on globalThis
const globalStoreKey = '__TEST_MAGIC_LINK_STORE__'
const globalStore = (
  globalThis as typeof globalThis & { [globalStoreKey]?: Map<string, MagicLinkRecord> }
)[globalStoreKey]

const magicLinkStore: Map<string, MagicLinkRecord> =
  globalStore || ((globalThis as any)[globalStoreKey] = new Map<string, MagicLinkRecord>())

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

export function getLatestTestMagicLink(email: string): MagicLinkRecord | null {
  if (!isTestMagicLinkEnabled) return null
  const normalizedEmail = email.toLowerCase()
  return magicLinkStore.get(normalizedEmail) ?? null
}

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


