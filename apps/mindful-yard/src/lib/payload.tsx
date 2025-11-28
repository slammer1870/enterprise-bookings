import configPromise from '@payload-config'
import { getPayloadAuth } from 'payload-auth/better-auth'

export const getPayload = async (): Promise<Awaited<ReturnType<typeof getPayloadAuth>>> =>
  getPayloadAuth(configPromise)

