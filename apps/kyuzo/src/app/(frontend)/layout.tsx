import React from 'react'
import '@repo/ui/globals.css'
import './globals.css'
import '@daveyplate/better-auth-ui/css'

import { Navbar } from '@/globals/navbar'
import { Footer } from '@/globals/footer'

import { Toaster } from 'sonner'

import PlausibleProvider from 'next-plausible'

import { GoogleTagManager } from '@next/third-parties/google'
import { TRPCReactProvider } from '@repo/trpc'
import { BetterAuthProvider } from '@/lib/auth/context'
import { BetterAuthUIProvider } from '@/lib/auth/provider'
import { getContextProps } from '@/lib/auth/context/get-context-props'

// Force dynamic rendering to prevent caching issues during E2E tests
export const dynamic = 'force-dynamic'

export const metadata = {
  description: 'Sign up today to get started on your Jiu Jitsu Journey!',
  title: 'Kyuzo Brazilian Jiu Jitsu',
}

export default async function RootLayout(props: {
  children: React.ReactNode
  unauthenticated: React.ReactNode
}) {
  const { children, unauthenticated } = props

  return (
    <html lang="en">
      <head>
        <GoogleTagManager gtmId="AW-11536098613" />
      </head>
      <PlausibleProvider domain="kyuzo.ie">
        <BetterAuthProvider {...getContextProps()}>
          <TRPCReactProvider>
            <body>
              <BetterAuthUIProvider>
                <main>
                  <Navbar />
                  {children}
                  {unauthenticated}
                  <Footer />
                </main>
                <div id="modal-root" />
                <Toaster />
              </BetterAuthUIProvider>
            </body>
          </TRPCReactProvider>
        </BetterAuthProvider>
      </PlausibleProvider>
    </html>
  )
}
