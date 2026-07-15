import { customSession } from 'better-auth/plugins'
import { buildSanitizedBetterAuthCustomSession } from '@repo/shared-utils'

/**
 * Strips Payload joins / sensitive fields from Better Auth session responses
 * (including `/api/auth/get-session` used by the client `useSession()` hook).
 */
export function createSanitizedSessionPlugin() {
  return customSession(async ({ user, session }: { user: Record<string, unknown>; session: Record<string, unknown> }) => {
    const slim = buildSanitizedBetterAuthCustomSession({ user, session })
    if (!slim) return { user, session }
    return slim
  })
}
