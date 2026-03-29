'use client'

import { AuthUIProvider } from '@daveyplate/better-auth-ui'
import NextLink from 'next/link'
import { useRouter } from 'next/navigation'
import type { ComponentProps, ReactNode } from 'react'
import { authClient } from '@/lib/auth/client'
import { getAuthUiBaseURL } from '@/lib/auth/getAuthUiBaseURL'

type NextLinkProps = ComponentProps<typeof NextLink>

function SafeLink(props: NextLinkProps) {
  const href = props.href == null ? '/' : props.href
  return <NextLink {...props} href={href} />
}

export function BetterAuthUIProvider({ children }: { children: ReactNode }) {
  const router = useRouter()

  return (
    <AuthUIProvider
      authClient={authClient}
      baseURL={getAuthUiBaseURL()}
      navigate={router.push}
      replace={router.replace}
      onSessionChange={() => router.refresh()}
      Link={SafeLink}
      magicLink
    >
      {children}
    </AuthUIProvider>
  )
}
