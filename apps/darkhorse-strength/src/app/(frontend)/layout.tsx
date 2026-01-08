import React from 'react'

import './globals.css'
import '@repo/ui/globals.css'
import '@daveyplate/better-auth-ui/css'

import { TRPCReactProvider } from '@repo/trpc'
import { Suspense } from 'react'

import { BetterAuthProvider } from '@/lib/auth/context'
import { BetterAuthUIProvider } from '@/lib/auth/provider'
import { getContextProps } from '@/lib/auth/context/get-context-props'

import Navbar from '@/components/navbar'
import Footer from '@/components/footer'

import { Toaster } from 'sonner'

import PlausibleProvider from 'next-plausible'

export const metadata = {
  description: 'Small Group Personal Training in a Private Facility located in Bray, Co. Wicklow',
  title: 'Dark Horse Strength and Performance',
}

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props

  return (
    <html lang="en">
      <PlausibleProvider domain="darkhorsestrength.ie">
        <BetterAuthProvider {...getContextProps()}>
          <TRPCReactProvider>
            <body>
              <BetterAuthUIProvider>
                <Suspense fallback={null}>
                  {/* reserved for any future trackers/hooks that rely on client navigation */}
                </Suspense>
                <main>
                  <Navbar />
                  {children}
                  <Footer />
                </main>
                <Toaster />
              </BetterAuthUIProvider>
            </body>
          </TRPCReactProvider>
        </BetterAuthProvider>
      </PlausibleProvider>
    </html>
  )
}
