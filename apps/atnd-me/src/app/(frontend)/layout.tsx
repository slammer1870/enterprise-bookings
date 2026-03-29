import type { Metadata } from 'next'
import { cookies, headers } from 'next/headers'

// Header/Footer use cookies(), layout uses draftMode(), pages use getSession()/headers().
// Force dynamic so these dynamic APIs are valid and we avoid DYNAMIC_SERVER_USAGE in CI/production.
export const dynamic = 'force-dynamic'
import React from 'react'

import { Footer } from '@/Footer/Component'
import { Header } from '@/Header/Component'
import { Providers } from '@/providers'
import { InitTheme } from '@/providers/Theme/InitTheme'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'

import '@repo/ui/globals.css'

import './globals.css'
import { Toaster } from 'sonner'
import { getPayload } from '@/lib/payload'
import { getTenantWithBranding } from '@/utilities/getTenantContext'
import { getAbsoluteURL, getTenantSiteURL } from '@/utilities/getURL'

export default async function RootLayout({
  children,
  unauthenticated,
}: {
  children: React.ReactNode
  unauthenticated: React.ReactNode
}) {

  return (
    <>
      {/* Must not render <html>/<head>/<body> here; root layout owns those tags. */}
      <InitTheme />
      <Providers>
        <Header />
        {children}
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
  const payload = await getPayload()
  const tenant = await getTenantWithBranding(payload, { cookies: cookieStore, headers: headersList })
  const siteUrl = getTenantSiteURL(tenant, headersList)
  const logoUrl =
    tenant?.logo && typeof tenant.logo === 'object' && typeof tenant.logo.url === 'string'
      ? getAbsoluteURL(tenant.logo.url, siteUrl)
      : undefined

  return {
    openGraph: mergeOpenGraph({
      images: logoUrl ? [{ url: logoUrl }] : undefined,
      siteName: tenant?.name || 'ATND ME',
      title: tenant?.name || 'ATND ME',
      url: siteUrl,
    }),
    twitter: {
      card: 'summary_large_image',
      creator: 'ATND',
      images: logoUrl ? [logoUrl] : undefined,
    },
  }
}
