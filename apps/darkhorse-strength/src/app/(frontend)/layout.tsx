import React from 'react'
import './globals.css'

import { AuthProvider } from '@repo/auth/src/providers/auth'

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
        <AuthProvider>
          <body>
            <main>
              <Navbar />
              {children}
              <Footer />
            </main>
            <Toaster />
          </body>
        </AuthProvider>
      </PlausibleProvider>
    </html>
  )
}
