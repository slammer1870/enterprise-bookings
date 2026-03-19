import type { Metadata } from 'next'

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
import { getServerSideURL } from '@/utilities/getURL'
import { Toaster } from 'sonner'

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

export const metadata: Metadata = {
  metadataBase: new URL(getServerSideURL()),
  openGraph: mergeOpenGraph(),
  twitter: {
    card: 'summary_large_image',
    creator: 'ATND',
  },
}
