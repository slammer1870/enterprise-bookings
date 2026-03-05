'use client'

import { AuthUIProvider } from '@daveyplate/better-auth-ui'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { authClient } from '@/lib/auth/client'
import { getAuthUiBaseURL } from '@/lib/auth/getAuthUiBaseURL'

export function BetterAuthUIProvider({ children }: { children: ReactNode }) {
  const router = useRouter()

  return (
    <AuthUIProvider
      authClient={authClient}
      baseURL={getAuthUiBaseURL()}
      navigate={router.push}
      replace={router.replace}
      onSessionChange={() => router.refresh()}
      Link={Link}
      magicLink
    >
      {children}
    </AuthUIProvider>
  )
}
