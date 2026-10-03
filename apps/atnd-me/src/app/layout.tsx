import React from 'react'
import type { Metadata } from 'next'
import { cookies, headers } from 'next/headers'
import Script from 'next/script'

import { cn } from '@/utilities/ui'
import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'
import { getPayload } from '@/lib/payload'
import { resolveUmamiAnalyticsConfig } from '@/lib/analytics/config'
import { UMAMI_BEFORE_SEND_SCRIPT } from '@/lib/analytics/umami-before-send'
import { getTenantWithBranding } from '@/utilities/getTenantContext'
import { getTenantSiteURL } from '@/utilities/getURL'
import { getRequestHostname } from '@/utilities/tenantRequest'

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
      logo && typeof logo === 'object' && logo !== null
        ? (() => {
            const squareLogoUrl =
              logo.sizes?.square && typeof logo.sizes.square.url === 'string'
                ? logo.sizes.square.url
                : logo.url
            return typeof squareLogoUrl === 'string'
              ? new URL(squareLogoUrl, metadataBase).toString()
              : null
          })()
        : null

    return {
      metadataBase,
      title: {
        default: appName,
        template: `%s | ${appName}`,
      },
      icons: logoUrl
        ? {
            icon: [{ url: logoUrl, sizes: '500x500' }],
            shortcut: logoUrl,
            apple: logoUrl,
          }
        : {
            icon: '/favicon.svg',
            shortcut: '/favicon.svg',
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
      icon: '/favicon.svg',
      shortcut: '/favicon.svg',
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

  const hostname = getRequestHostname(headersList)
  const umami = resolveUmamiAnalyticsConfig(hostname)

  return (
    <html className={cn(GeistSans.variable, GeistMono.variable)} lang="en" suppressHydrationWarning>
      <body>
        {children}
        {umami.enabled && (
          <>
            <Script id="umami-before-send" strategy="beforeInteractive">
              {UMAMI_BEFORE_SEND_SCRIPT}
            </Script>
            <Script
              id="umami-tracker"
              strategy="afterInteractive"
              src={umami.scriptUrl}
              data-analytics-provider="umami"
              data-before-send="umamiBeforeSend"
              data-domains={umami.domainsAttribute}
              data-website-id={umami.websiteId}
            />
          </>
        )}
      </body>
    </html>
  )
}
