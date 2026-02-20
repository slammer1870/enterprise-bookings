'use client'

import { AuthUIProvider } from '@daveyplate/better-auth-ui'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { authClient } from '@/lib/auth/client'
import { isTenantRequiredCreatePath } from '@/components/admin/prevent-create-page-reload'

export function BetterAuthUIProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const pathnameRef = useRef(pathname)
  useLayoutEffect(() => {
    pathnameRef.current = pathname
  }, [pathname])

  return (
    <AuthUIProvider
      authClient={authClient}
      navigate={router.push}
      replace={router.replace}
      onSessionChange={() => {
        // Read current pathname from ref so we don't use a stale closure when
        // session revalidates (e.g. on mobile focus/visibility).
        // Skip refresh on tenant-required create pages to avoid clearing the form.
        if (!isTenantRequiredCreatePath(pathnameRef.current)) {
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
