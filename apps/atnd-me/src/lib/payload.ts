import configPromise from '@payload-config'
import { getPayloadAuth } from 'payload-auth/better-auth'

// Matches other apps (bru-grappling/kyuzo/etc) so `payload.betterAuth` is properly typed.
export const getPayload = async (): Promise<Awaited<ReturnType<typeof getPayloadAuth>>> =>
  getPayloadAuth(configPromise)
