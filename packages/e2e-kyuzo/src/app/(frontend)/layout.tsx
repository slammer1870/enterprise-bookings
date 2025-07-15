import React from 'react'
import './globals.css'

import { AuthProvider } from '@repo/auth/src/providers/auth'

import { Navbar } from '@/globals/navbar'
import { Footer } from '@/globals/footer'

import { Toaster } from 'sonner'

import PlausibleProvider from 'next-plausible'

export const metadata = {
  description: 'Sign up today to get started on your Jiu Jitsu Journey!',
  title: 'Kyuzo Brazilian Jiu Jitsu',
}

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props

  return (
    <html lang="en">
      <PlausibleProvider domain="kyuzo.ie">
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
