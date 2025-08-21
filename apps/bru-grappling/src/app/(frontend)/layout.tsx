import './globals.css'

import { Roboto } from 'next/font/google'

import { Toaster } from 'sonner'

import { AuthProvider } from '@repo/auth'

import PlausibleProvider from 'next-plausible'

import { Navbar } from '@/globals/navbar'
import { Footer } from '@/globals/footer'

import { TRPCReactProvider } from '@repo/trpc'

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-roboto',
})

export const metadata = {
  description: 'Brazilian Jiu Jitsu and Grappling Lessons for Kids and Adults in Dublin',
  title: 'Bru Grappling',
}

export default async function RootLayout({
  children,
  unauthenticated,
}: {
  children: React.ReactNode
  unauthenticated: React.ReactNode
}) {
  return (
    <html lang="en">
      <PlausibleProvider domain="brugrappling.ie">
        <AuthProvider>
          <TRPCReactProvider>
            <body className={roboto.className}>
              <Navbar />
              {children}
              {unauthenticated}
              <Footer />
              <div id="modal-root" />
              <Toaster />
            </body>
          </TRPCReactProvider>
        </AuthProvider>
      </PlausibleProvider>
    </html>
  )
}
