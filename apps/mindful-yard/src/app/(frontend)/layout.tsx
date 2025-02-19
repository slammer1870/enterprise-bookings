import './globals.css'

import { Roboto } from 'next/font/google'
import { Toaster } from 'sonner'

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-roboto',
})

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body className={roboto.className}>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
