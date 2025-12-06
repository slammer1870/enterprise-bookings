import React from 'react'
import './globals.css'

import { AuthProvider } from '@repo/auth-next'

import { Navbar } from '@/globals/navbar'
import { Footer } from '@/globals/footer'

import { Toaster } from 'sonner'

import PlausibleProvider from 'next-plausible'

import { GoogleTagManager } from '@next/third-parties/google'

export const metadata = {
  description: 'Sign up today to get started on your Jiu Jitsu Journey!',
  title: 'Kyuzo Brazilian Jiu Jitsu',
}

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props

  return (
    <html lang="en">
      <head>
        <GoogleTagManager gtmId="AW-11536098613" />
      </head>
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
