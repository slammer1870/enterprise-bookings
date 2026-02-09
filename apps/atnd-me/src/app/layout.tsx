import React from 'react'

import { cn } from '@/utilities/ui'
import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'

/**
 * Root Layout.
 *
 * Note: Nested layouts (e.g. `(frontend)/layout.tsx`) must NOT render `<html>`/`<body>`.
 * Rendering those tags in nested layouts can cause invalid markup and break React hydration,
 * which in turn breaks client-side interactivity (critical for Playwright E2E).
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html className={cn(GeistSans.variable, GeistMono.variable)} lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}
