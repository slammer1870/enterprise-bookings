import './globals.css'

import { Roboto } from 'next/font/google'
import { Toaster } from 'sonner'

import { AuthProvider } from '@repo/auth/src/providers/auth'

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
    <html>
      <AuthProvider>
        <body className={roboto.className}>
          {children}
          {unauthenticated}
          <div id="modal-root" />
          <Toaster />
        </body>
      </AuthProvider>
    </html>
  )
}
