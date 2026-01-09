'use client'

import { AuthUIProvider } from '@daveyplate/better-auth-ui'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useCallback, type ReactNode } from 'react'
import { authClient } from '@/lib/auth/client'

export function BetterAuthUIProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  // Check if we're in admin - if so, don't wrap with AuthUIProvider at all
  const isAdminRoute =
    pathname?.startsWith('/admin') ||
    (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin'))

  const handleSessionChange = useCallback(() => {
    // Completely disabled to prevent refresh loops
    // Session changes are still tracked by the auth system,
    // but we won't trigger router refreshes which can cause loops
    return
  }, [])

  // Don't wrap admin routes with AuthUIProvider at all
  if (isAdminRoute) {
    return <>{children}</>
  }

  return (
    <AuthUIProvider
      authClient={authClient}
      navigate={router.push}
      replace={router.replace}
      onSessionChange={handleSessionChange}
      Link={Link}
    >
      {children}
    </AuthUIProvider>
  )
}








