import { getPayload } from '@/lib/payload'
import type {
  BetterAuthAccount,
  BetterAuthDeviceSession,
  BetterAuthSession,
  BetterAuthUser,
} from '@repo/shared-types'

export type Session = BetterAuthSession<typeof getPayload>
export type User = BetterAuthUser<typeof getPayload>
export type Account = BetterAuthAccount<typeof getPayload>
export type DeviceSession = BetterAuthDeviceSession<typeof getPayload>







