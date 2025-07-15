import { NavbarGlobal } from './client'
import { getCachedGlobal } from '@/utils/get-globals'
import React from 'react'

import type { Navbar } from '@/payload-types'

export async function Navbar() {
  const navbarData = (await getCachedGlobal('navbar', 1)()) as Navbar

  return <NavbarGlobal data={navbarData} />
}
