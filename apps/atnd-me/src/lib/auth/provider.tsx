'use client'

import { AuthUIProvider } from '@daveyplate/better-auth-ui'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { authClient } from '@/lib/auth/client'
import { isTenantRequiredCreatePath } from '@/components/admin/prevent-create-page-reload'

export function BetterAuthUIProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  return (
    <AuthUIProvider
      authClient={authClient}
      navigate={router.push}
      replace={router.replace}
      onSessionChange={() => {
        // Clear router cache (protected routes), but skip on tenant-required create
        // pages to avoid clearing the form when session revalidates (e.g. on mobile).
        if (!isTenantRequiredCreatePath(pathname)) {
          router.refresh()
        }
      }}
      Link={Link}
      magicLink
    >
      {children}
    </AuthUIProvider>
  )
}
