import React from 'react'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'

import { cn } from '@/utilities/ui'
import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'
import { getPayload } from '@/lib/payload'
import { getTenantWithBranding } from '@/utilities/getTenantContext'

/**
 * Root Layout.
 *
 * Note: Nested layouts (e.g. `(frontend)/layout.tsx`) must NOT render `<html>`/`<body>`.
 * Rendering those tags in nested layouts can cause invalid markup and break React hydration,
 * which in turn breaks client-side interactivity (critical for Playwright E2E).
 */
export async function generateMetadata(): Promise<Metadata> {
  try {
    const cookieStore = await cookies()
    const payload = await getPayload()
    const tenant = await getTenantWithBranding(payload, { cookies: cookieStore })
    const logo = tenant?.logo
    const logoUrl =
      logo && typeof logo === 'object' && logo !== null && typeof logo.url === 'string'
        ? logo.url
        : null

    if (logoUrl) {
      return {
        icons: {
          icon: logoUrl,
          shortcut: logoUrl,
          apple: logoUrl,
        },
      }
    }
  } catch {
    // Fall through to default favicon
  }
  return {
    icons: {
      icon: '/favicon.ico',
      shortcut: '/favicon.ico',
      apple: '/favicon.svg',
    },
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html className={cn(GeistSans.variable, GeistMono.variable)} lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}
