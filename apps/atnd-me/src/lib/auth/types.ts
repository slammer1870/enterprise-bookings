import { getPayload } from '@/lib/payload'
import type { BetterAuthAccount, BetterAuthDeviceSession } from '@repo/shared-types'
import type {
  SanitizedBetterAuthSession,
  SanitizedBetterAuthUser,
} from '@repo/shared-utils'

// Match conventions used in other apps (bru-grappling/kyuzo/etc).
/** Returned by `getSession()` after stripping Payload joins / relations. */
export type Session = SanitizedBetterAuthSession
export type User = SanitizedBetterAuthUser
export type Account = BetterAuthAccount<typeof getPayload>
export type DeviceSession = BetterAuthDeviceSession<typeof getPayload>
