import { FooterGlobal } from './client'
import { getCachedGlobal } from '@/utils/get-globals'
import React from 'react'

import type { Footer } from '@/payload-types'

export async function Footer() {
  const footerData = (await getCachedGlobal('footer', 1)()) as Footer | null

  // If footer data isn't available (e.g., fresh DB in tests), render a minimal fallback
  if (!footerData) {
    return (
      <footer className="py-8 text-center text-sm text-gray-500">
        © {new Date().getFullYear()} Kyuzo
      </footer>
    )
  }

  return <FooterGlobal data={footerData} />
}
