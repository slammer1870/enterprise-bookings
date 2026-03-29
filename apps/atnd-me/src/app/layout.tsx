import React from 'react'
import type { Metadata } from 'next'
import { cookies, headers } from 'next/headers'

import { cn } from '@/utilities/ui'
import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'
import { getPayload } from '@/lib/payload'
import { getTenantWithBranding } from '@/utilities/getTenantContext'
import { getTenantSiteURL } from '@/utilities/getURL'

/** Set by middleware for /admin so Payload's RootLayout is the only document (avoids nested <html>/<body>). */
const ADMIN_HEADER = 'x-next-payload-admin'

/**
 * Root Layout.
 *
 * For /admin, we render only {children} so Payload's RootLayout in (payload)/layout.tsx
 * is the sole document (avoids "html cannot be a child of body" hydration error).
 * For all other routes, we provide the document shell.
 *
 * Nested layouts (e.g. `(frontend)/layout.tsx`) must NOT render `<html>`/`<body>`.
 */
export async function generateMetadata(): Promise<Metadata> {
  const fallbackAppName = 'ATND ME'
  try {
    const cookieStore = await cookies()
    const headersList = await headers()
    const payload = await getPayload()
    const tenant = await getTenantWithBranding(payload, { cookies: cookieStore, headers: headersList })
    const logo = tenant?.logo
    const appName = tenant?.name?.trim() || tenant?.slug?.trim() || fallbackAppName
    const metadataBase = new URL(getTenantSiteURL(tenant, headersList))
    const logoUrl =
      logo && typeof logo === 'object' && logo !== null && typeof logo.url === 'string'
        ? new URL(logo.url, metadataBase).toString()
        : null

    return {
      metadataBase,
      title: {
        default: appName,
        template: `%s | ${appName}`,
      },
      icons: logoUrl
        ? {
            icon: logoUrl,
            shortcut: logoUrl,
            apple: logoUrl,
          }
        : {
            icon: '/favicon.ico',
            shortcut: '/favicon.ico',
            apple: '/favicon.svg',
          },
    }
  } catch {
    // Fall through to default favicon
  }
  return {
    metadataBase: new URL(getTenantSiteURL()),
    title: {
      default: fallbackAppName,
      template: `%s | ${fallbackAppName}`,
    },
    icons: {
      icon: '/favicon.ico',
      shortcut: '/favicon.ico',
      apple: '/favicon.svg',
    },
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers()
  const isPayloadAdmin = headersList.get(ADMIN_HEADER) === '1'

  if (isPayloadAdmin) {
    return <>{children}</>
  }

  return (
    <html className={cn(GeistSans.variable, GeistMono.variable)} lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}
