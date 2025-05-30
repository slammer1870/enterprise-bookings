import '@repo/ui/globals.css'

import { Navbar } from '@/globals/navbar'
import { AuthProvider } from '@repo/auth/src/providers/auth'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <AuthProvider>
        <body>
          <Navbar />
          {children}
        </body>
      </AuthProvider>
    </html>
  )
}
