import configPromise from '@payload-config'
import { getPayloadAuth } from 'payload-auth/better-auth/plugin'

// Matches other apps (bru-grappling/kyuzo/etc) so `payload.betterAuth` is properly typed.
let cachedPayloadPromise: ReturnType<typeof getPayloadAuth> | null = null

export const getPayload = async (): Promise<Awaited<ReturnType<typeof getPayloadAuth>>> => {
  cachedPayloadPromise ??= getPayloadAuth(configPromise)
  return await cachedPayloadPromise
}
