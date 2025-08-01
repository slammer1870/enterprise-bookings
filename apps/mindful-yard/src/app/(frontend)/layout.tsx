import './globals.css'

import { Roboto } from 'next/font/google'
import { Toaster } from 'sonner'

import { AuthProvider } from '@repo/auth'

import PlausibleProvider from 'next-plausible'

import Navbar from '@/components/navbar'
import Footer from '@/components/footer'
const roboto = Roboto({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-roboto',
})

export default function RootLayout({
  children,
  unauthenticated,
}: {
  children: React.ReactNode
  unauthenticated: React.ReactNode
}) {
  return (
    <html lang="en">
      <PlausibleProvider domain="mindfulyard.ie">
        <AuthProvider>
          <body className={roboto.className}>
            <Navbar />
            {children}
            {unauthenticated}
            <Footer />
            <div id="modal-root" />
            <Toaster />
          </body>
        </AuthProvider>
      </PlausibleProvider>
    </html>
  )
}
