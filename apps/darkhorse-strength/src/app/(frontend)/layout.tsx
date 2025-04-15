import React from 'react'
import './globals.css'

import { AuthProvider } from '@repo/auth/src/providers/auth'

import Navbar from '@/components/navbar'
//import Footer from '@/components/footer'

export const metadata = {
  description: 'A blank template using Payload in a Next.js app.',
  title: 'Payload Blank Template',
}

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props

  return (
    <html lang="en">
      <AuthProvider>
        <body>
          <main>
            <Navbar />
            {children}
            {/* <Footer /> */}
          </main>
        </body>
      </AuthProvider>
    </html>
  )
}
