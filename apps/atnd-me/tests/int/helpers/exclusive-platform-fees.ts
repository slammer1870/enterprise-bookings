import type { Payload } from 'payload'

/** Serialize reads/writes to the singleton `platform-fees` global across parallel int tests. */
let mutex: Promise<void> = Promise.resolve()

export async function withExclusivePlatformFees<T>(fn: () => Promise<T>): Promise<T> {
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const previous = mutex
  mutex = previous.then(() => gate)
  await previous
  try {
    return await fn()
  } finally {
    release()
  }
}

export async function updatePlatformFeesGlobal(
  payload: Payload,
  data: Record<string, unknown>,
): Promise<void> {
  await payload.updateGlobal({
    slug: 'platform-fees',
    data,
    depth: 0,
    overrideAccess: true,
  } as Parameters<Payload['updateGlobal']>[0])
}
