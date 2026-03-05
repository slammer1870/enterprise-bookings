'use client'

import React from 'react'

import { Navbar as NavbarType } from '@/payload-types'
import { Logo } from '@/graphics/logo'

import Link from 'next/link'

export const NavbarGlobal: React.FC<{ data: NavbarType }> = ({ data: _data }) => {


  return (
    <div className="w-full top-0 left-0 absolute z-50">
      <div className="flex items-center justify-start mx-auto p-4">
        <Link href="/" className="w-16 h-16">
          <Logo />
        </Link>
      </div>
    </div>
  )
}

export default NavbarGlobal
