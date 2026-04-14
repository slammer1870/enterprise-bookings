import type { ReactNode } from 'react'

import { BetterAuthUIProvider } from '@/lib/auth/provider'

/**
 * Auth UI (sign-in, OTP, etc.) requires AuthUIProvider. Keeping it here avoids pulling
 * `@daveyplate/better-auth-ui` into the shared layout chunk for the rest of the site.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <BetterAuthUIProvider>{children}</BetterAuthUIProvider>
}
