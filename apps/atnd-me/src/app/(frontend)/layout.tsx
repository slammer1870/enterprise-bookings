import type { Metadata } from 'next'
import { cookies, headers } from 'next/headers'
import React from 'react'

// Allow ISR-style data caching (unstable_cache / revalidate tags). Request is still
// dynamic when cookies()/headers() are read, but we no longer disable the Data Cache.
export const revalidate = 60

import { Footer } from '@/Footer/Component'
import { Header } from '@/Header/Component'
import { Providers } from '@/providers'
import { InitTheme } from '@/providers/Theme/InitTheme'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import {
  isPlatformPublicHostname,
  publicHostErrorMetadata,
  readPublicHostOutcome,
} from '@/utilities/publicHostOutcome'
import { getRequestHostname } from '@/utilities/tenantRequest'

import '@repo/ui/globals.css'

import './globals.css'
import { Toaster } from 'sonner'
import { getPayload } from '@/lib/payload'
import { getTenantWithBranding } from '@/utilities/getTenantContext'
import { getAbsoluteMediaURL, getIndexedURL, getTenantSiteURL } from '@/utilities/getURL'
import { indexedHostnameForTenant } from '@/utilities/resolvePublicTenant'

/** One logo URL for structured data and share images. */
function tenantLogoUrl(
  tenant: Awaited<ReturnType<typeof getTenantWithBranding>>,
  siteUrl: string,
): string | undefined {
  const logo = tenant?.logo
  if (!logo || typeof logo !== 'object' || typeof logo.url !== 'string') return undefined
  return getAbsoluteMediaURL(logo.url, siteUrl)
}

export default async function RootLayout({
  children,
  unauthenticated,
}: {
  children: React.ReactNode
  unauthenticated: React.ReactNode
}) {

  const cookieStore = await cookies()
  const headersList = await headers()
  const payload = await getPayload()
  const tenant = await getTenantWithBranding(payload, { cookies: cookieStore, headers: headersList })
  const siteUrl = getTenantSiteURL(tenant, headersList)
  const logoUrl = tenantLogoUrl(tenant, siteUrl)
  const structuredData = tenant
    ? {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: tenant.name || tenant.slug,
        url: siteUrl,
        ...(tenant.description ? { description: tenant.description } : {}),
        ...(logoUrl ? { logo: logoUrl } : {}),
      }
    : null

  return (
    <>
      {structuredData && (
        <script
          id="tenant-structured-data"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      )}
      {/* Must not render <html>/<head>/<body> here; root layout owns those tags. */}
      <InitTheme />
      <Providers>
        <Header />
        <main>{children}</main>
        {unauthenticated}
        <Footer />
        <div id="modal-root" />
        <Toaster />
      </Providers>
    </>
  )
}

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies()
  const headersList = await headers()
  const hostOutcome = readPublicHostOutcome(headersList)
  if (hostOutcome) {
    return publicHostErrorMetadata(hostOutcome)
  }

  const payload = await getPayload()
  const tenant = await getTenantWithBranding(payload, { cookies: cookieStore, headers: headersList })
  const requestHostname = getRequestHostname(headersList)
  const usePlatformDefaults = Boolean(
    requestHostname && isPlatformPublicHostname(requestHostname) && !tenant,
  )
  const siteUrl = getTenantSiteURL(tenant, headersList)
  const requestPath = headersList.get('x-request-pathname')
  const canonicalHostname = indexedHostnameForTenant(tenant)
  const indexedUrl =
    canonicalHostname && requestPath
      ? getIndexedURL(canonicalHostname, requestPath)
      : siteUrl
  const logoUrl = tenantLogoUrl(tenant, siteUrl)

  return {
    ...(canonicalHostname && requestPath
      ? { alternates: { canonical: indexedUrl } }
      : {}),
    openGraph: mergeOpenGraph(
      {
        images: logoUrl ? [{ url: logoUrl }] : undefined,
        siteName: tenant?.name || 'ATND ME',
        title: tenant?.name || 'ATND ME',
        url: indexedUrl,
      },
      { usePlatformDefaults },
    ),
    twitter: {
      card: 'summary_large_image',
      creator: 'ATND',
      images: logoUrl ? [logoUrl] : undefined,
    },
  }
}
