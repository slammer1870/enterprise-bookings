import type { Viewport } from 'next'
import type { ReactNode } from 'react'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return children
}
