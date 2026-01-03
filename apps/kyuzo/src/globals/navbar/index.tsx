import { NavbarGlobal } from './client'
import { getCachedGlobal } from '@/utils/get-globals'
import React from 'react'

import type { Navbar } from '@/payload-types'

export async function Navbar() {
  const navbarData = (await getCachedGlobal('navbar', 1)()) as Navbar | null

  // If navbar data isn't available (e.g., fresh DB in tests), render a minimal fallback
  if (!navbarData) {
    return (
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm p-4">
        <a href="/" className="font-bold">
          Kyuzo
        </a>
      </nav>
    )
  }

  return <NavbarGlobal data={navbarData} />
}
