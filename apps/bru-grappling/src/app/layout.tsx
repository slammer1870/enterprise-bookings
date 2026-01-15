import type { Metadata, Viewport } from 'next'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1.0,
}

export const metadata: Metadata = {}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children
}
